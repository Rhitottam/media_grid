/**
 * WASM Loader - loads and initializes the WASM module
 */

export interface WASMExports {
  // Canvas management
  createCanvas(width: number, height: number, gridSize: number): void
  updateCanvasSize(width: number, height: number): void
  clearCanvas(): void
  
  // Object operations
  addObject(x: number, y: number, width: number, height: number, assetId: number, type: number): number
  moveObject(objectId: number, x: number, y: number): void
  deleteObject(objectId: number): void
  resizeObject(objectId: number, newX: number, newY: number, newWidth: number, newHeight: number): void
  
  // Batch operations
  moveObjects(objectIds: Uint32Array, dx: number, dy: number): void
  deleteObjects(objectIds: Uint32Array): void
  beginBatchMove(): void
  addToBatchMove(objectId: number, oldX: number, oldY: number, newX: number, newY: number): void
  endBatchMove(): void
  beginBatchResize(): void
  addToBatchResize(objectId: number, oldX: number, oldY: number, oldWidth: number, oldHeight: number, newX: number, newY: number, newWidth: number, newHeight: number): void
  endBatchResize(): void
  
  // Camera operations
  pan(dx: number, dy: number): void
  zoom(factor: number, centerX: number, centerY: number): void
  getCameraX(): number
  getCameraY(): number
  getCameraZoom(): number
  
  // Grid operations
  setGridSnap(enabled: boolean): void
  setGridSize(size: number): void
  getGridSize(): number
  
  // Viewport queries
  updateViewport(): void
  getVisibleCount(): number
  getVisibleObjectId(index: number): number
  getVisibleObjectAssetId(index: number): number
  getTransformX(index: number): number
  getTransformY(index: number): number
  getTransformWidth(index: number): number
  getTransformHeight(index: number): number
  
  // Object queries
  getObjectCount(): number
  getObjectIdAtIndex(index: number): number
  getObjectX(objectId: number): number
  getObjectY(objectId: number): number
  getObjectWidth(objectId: number): number
  getObjectHeight(objectId: number): number
  getObjectAssetId(objectId: number): number
  getObjectType(objectId: number): number
  objectExists(objectId: number): boolean
  
  // History
  undo(): void
  redo(): void
  canUndo(): boolean
  canRedo(): boolean
  
  // State version for React sync
  getStateVersion(): number
}

let wasmInstance: WASMExports | null = null
let wasmBinary: ArrayBuffer | null = null

/**
 * Preload WASM binary
 */
export async function preloadWASM(): Promise<ArrayBuffer> {
  if (wasmBinary) return wasmBinary
  
  // The WASM module is imported as an ES module that exports an instantiate function
  const wasmUrl = new URL('@convadraw/wasm/optimized.wasm', import.meta.url)
  const response = await fetch(wasmUrl)
  wasmBinary = await response.arrayBuffer()
  return wasmBinary
}

/**
 * Load and initialize WASM module
 */
export async function loadWASM(): Promise<WASMExports> {
  if (wasmInstance) return wasmInstance
  
  try {
    const binary = await preloadWASM()
    
    const { instance } = await WebAssembly.instantiate(binary, {
      env: {
        abort: (message: number, fileName: number, lineNumber: number, columnNumber: number) => {
          console.error('WASM abort:', { message, fileName, lineNumber, columnNumber })
          throw new Error('WASM abort')
        }
      }
    })
    
    wasmInstance = instance.exports as unknown as WASMExports
    return wasmInstance
  } catch (error) {
    console.error('Failed to load WASM:', error)
    throw error
  }
}

/**
 * Get the current WASM instance (throws if not loaded)
 */
export function getWASM(): WASMExports {
  if (!wasmInstance) {
    throw new Error('WASM not loaded. Call loadWASM() first.')
  }
  return wasmInstance
}

/**
 * Check if WASM is loaded
 */
export function isWASMLoaded(): boolean {
  return wasmInstance !== null
}
