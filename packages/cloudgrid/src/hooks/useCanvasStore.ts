import { useCallback, useEffect, useSyncExternalStore } from 'react'
import type { CanvasImage } from '../types/canvas'
import type { WASMExports } from '../utils/wasmLoader'

// Asset ID to source URL mapping (kept in JS for efficient string handling)
const assetRegistry = new Map<number, string>();
let nextAssetId = 1;

export function registerAsset(src: string): number {
  const id = nextAssetId++;
  assetRegistry.set(id, src);
  return id;
}

export function getAssetSrc(assetId: number): string {
  return assetRegistry.get(assetId) || '';
}

export function clearAssetRegistry(): void {
  assetRegistry.clear();
  nextAssetId = 1;
}

// Store for external subscription pattern
interface CanvasState {
  images: CanvasImage[];
  stateVersion: number;
}

let currentState: CanvasState = { images: [], stateVersion: 0 };
const listeners = new Set<() => void>();

function emitChange() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): CanvasState {
  return currentState;
}

// Sync WASM state to React state
export function syncFromWasm(wasm: WASMExports): void {
  const wasmVersion = wasm.getStateVersion();
  
  // Only sync if version changed
  if (wasmVersion === currentState.stateVersion) return;
  
  const count = wasm.getObjectCount();
  const images: CanvasImage[] = [];
  
  for (let i = 0; i < count; i++) {
    const objectId = wasm.getObjectIdAtIndex(i);
    if (objectId === 0) continue;
    
    const assetId = wasm.getObjectAssetId(objectId);
    const src = getAssetSrc(assetId);
    
    if (src) {
      images.push({
        id: `img-${objectId}`,
        x: wasm.getObjectX(objectId),
        y: wasm.getObjectY(objectId),
        width: wasm.getObjectWidth(objectId),
        height: wasm.getObjectHeight(objectId),
        src,
      });
    }
  }
  
  currentState = { images, stateVersion: wasmVersion };
  emitChange();
}

// Hook for components to use canvas state
export function useCanvasStore() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// Hook for canvas actions
export function useCanvasActions(wasm: WASMExports | null) {
  const moveObject = useCallback(
    (objectId: number, x: number, y: number) => {
      if (!wasm) return;
      wasm.moveObject(objectId, x, y);
      syncFromWasm(wasm);
    },
    [wasm]
  );

  const resizeObject = useCallback(
    (objectId: number, x: number, y: number, width: number, height: number) => {
      if (!wasm) return;
      wasm.resizeObject(objectId, x, y, width, height);
      syncFromWasm(wasm);
    },
    [wasm]
  );

  // Batch move: moves multiple objects as a single history entry
  const batchMoveObjects = useCallback(
    (moves: Array<{ objectId: number; x: number; y: number }>) => {
      if (!wasm || moves.length === 0) return;
      
      wasm.beginBatchMove();
      moves.forEach(({ objectId, x, y }) => {
        wasm.addToBatchMove(objectId, x, y);
      });
      wasm.endBatchMove();
      syncFromWasm(wasm);
    },
    [wasm]
  );

  // Batch resize: resizes multiple objects as a single history entry
  const batchResizeObjects = useCallback(
    (resizes: Array<{ objectId: number; x: number; y: number; width: number; height: number }>) => {
      if (!wasm || resizes.length === 0) return;
      
      wasm.beginBatchResize();
      resizes.forEach(({ objectId, x, y, width, height }) => {
        wasm.addToBatchResize(objectId, x, y, width, height);
      });
      wasm.endBatchResize();
      syncFromWasm(wasm);
    },
    [wasm]
  );

  const deleteObject = useCallback(
    (objectId: number) => {
      if (!wasm) return;
      wasm.deleteObject(objectId);
      syncFromWasm(wasm);
    },
    [wasm]
  );

  const deleteObjects = useCallback(
    (objectIds: number[]) => {
      if (!wasm || objectIds.length === 0) return;
      
      // For batch operations, we need to pass data to WASM via memory
      // For simplicity, we'll do individual deletes but skip syncing until the end
      objectIds.forEach((id) => wasm.deleteObject(id));
      syncFromWasm(wasm);
    },
    [wasm]
  );

  const undo = useCallback(() => {
    if (!wasm) return false;
    const result = wasm.undo();
    if (result) syncFromWasm(wasm);
    return result;
  }, [wasm]);

  const redo = useCallback(() => {
    if (!wasm) return false;
    const result = wasm.redo();
    if (result) syncFromWasm(wasm);
    return result;
  }, [wasm]);

  const canUndo = useCallback(() => {
    if (!wasm) return false;
    return wasm.canUndo();
  }, [wasm]);

  const canRedo = useCallback(() => {
    if (!wasm) return false;
    return wasm.canRedo();
  }, [wasm]);

  return {
    moveObject,
    resizeObject,
    batchMoveObjects,
    batchResizeObjects,
    deleteObject,
    deleteObjects,
    undo,
    redo,
    canUndo,
    canRedo,
  };
}

// Keyboard shortcuts hook
export function useUndoRedoShortcuts(
  wasm: WASMExports | null,
  onUndoRedo?: () => void
) {
  useEffect(() => {
    if (!wasm) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const isMod = e.metaKey || e.ctrlKey;

      if (isMod && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        const result = wasm.undo();
        if (result) {
          syncFromWasm(wasm);
          onUndoRedo?.();
        }
      } else if (
        (isMod && e.key === 'z' && e.shiftKey) ||
        (isMod && e.key === 'y')
      ) {
        e.preventDefault();
        const result = wasm.redo();
        if (result) {
          syncFromWasm(wasm);
          onUndoRedo?.();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [wasm, onUndoRedo]);
}

// Initialize canvas with images
export function initializeCanvasWithImages(
  wasm: WASMExports,
  images: Array<{ src: string; x: number; y: number; width: number; height: number }>
): void {
  images.forEach((img) => {
    const assetId = registerAsset(img.src);
    wasm.addObject(img.x, img.y, img.width, img.height, assetId, 1);
  });
  
  syncFromWasm(wasm);
}

// Get numeric object ID from string ID
export function getNumericId(id: string): number {
  const match = id.match(/img-(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}
