import type { ToolType } from '@convadraw/state'
import Konva from 'konva'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Image as KonvaImage, Layer, Rect, Stage, Transformer } from 'react-konva'
import { useCamera } from './CameraContext'
import { updateCameraState } from './hooks/useCameraState'
import {
  clearAssetRegistry,
  getNumericId,
  registerAsset,
  syncFromWasm,
  useCanvasActions,
  useCanvasStore,
  useUndoRedoShortcuts,
} from './hooks/useCanvasStore'
import { getGroupSnapOffset, snapToGrid } from './lib/grid-utils'
import type { CanvasImage } from './types/canvas'
import type { WASMExports } from './utils/wasmLoader'

// Import workers
import { createGridWorker, createImageLoaderWorker } from './workers/createWorker'

interface CanvasProps {
  wasm: WASMExports | null;
  activeTool: ToolType;
  gridSize: number;
  onStatsUpdate: (visible: number, total: number, fps: number) => void;
}

// Resize limits (as multipliers of gridSize)
const MIN_SIZE_MULTIPLIER = 2;
const MAX_SIZE_MULTIPLIER = 200;

// ============= Memory-Efficient Image Loading with LOD =============
// Worker caches compressed blobs (~100-200KB each)
// Main thread only holds decoded bitmaps for VISIBLE images
// Bitmaps are re-decoded at appropriate resolution when zoom/size changes
// Bitmaps are closed when images leave viewport

// Resolution levels - same URL decoded at different sizes
const LOD_LEVELS = {
  small: 150,   // For thumbnails / zoomed out
  medium: 400,  // For normal view
  full: 0,      // 0 = original resolution
} as const;

type LODLevel = keyof typeof LOD_LEVELS;

// Track which blobs are cached in the worker
const cachedBlobs = new Set<string>();
const loadingBlobs = new Set<string>();

// Track decoded bitmaps with their current LOD level
interface DecodedEntry {
  bitmap: ImageBitmap;
  level: LODLevel;
}
const decodedBitmaps = new Map<string, DecodedEntry>();
const decodingImages = new Map<string, LODLevel>(); // Track what level is being decoded

// Color data for sorting
interface ImageColor {
  r: number;
  g: number;
  b: number;
}
const imageColors = new Map<string, ImageColor>();

let imageWorker: Worker | null = null;

// Determine which LOD level to use based on display size
function getLODLevel(displayWidth: number, displayHeight: number): LODLevel {
  const maxDim = Math.max(displayWidth, displayHeight);
  if (maxDim <= 150) return 'small';
  if (maxDim <= 400) return 'medium';
  return 'full';
}

function getImageWorker(): Worker {
  if (!imageWorker) {
    imageWorker = createImageLoaderWorker()
    imageWorker.onmessage = (e) => {
      const { type, id, bitmap, requestedMaxDim, color } = e.data;
      
      if (type === 'cached') {
        // Blob is now cached in worker, ready for decode
        cachedBlobs.add(id);
        loadingBlobs.delete(id);
        
        // Store color data for sorting
        if (color) {
          imageColors.set(id, color);
          window.dispatchEvent(new CustomEvent('image-color-ready', { detail: { id, color } }));
        }
        
        window.dispatchEvent(new CustomEvent('blob-cached', { detail: { id } }));
      } else if (type === 'decoded' && bitmap) {
        // Determine which level this decode was for
        const level = decodingImages.get(id) || 
          (requestedMaxDim === 150 ? 'small' : requestedMaxDim === 400 ? 'medium' : 'full');
        decodingImages.delete(id);
        
        // Close any existing bitmap for this id
        const existing = decodedBitmaps.get(id);
        if (existing) {
          try { existing.bitmap.close(); } catch { /* ignore */ }
        }
        
        decodedBitmaps.set(id, { bitmap, level });
        window.dispatchEvent(new CustomEvent('image-decoded', { detail: { id, level } }));
      } else if (type === 'error') {
        loadingBlobs.delete(id);
        decodingImages.delete(id);
      }
    };
  }
  return imageWorker;
}

// Request blob to be cached (fast, no limit on concurrent requests)
function requestBlobCache(src: string): void {
  if (cachedBlobs.has(src) || loadingBlobs.has(src)) return;
  loadingBlobs.add(src);
  const worker = getImageWorker();
  worker.postMessage({ type: 'load', id: src, src });
}

// Request decode of a cached blob at specific LOD level
function requestDecode(src: string, level: LODLevel): void {
  if (!cachedBlobs.has(src)) return;
  
  // Skip if already decoding at this or higher level
  const currentlyDecoding = decodingImages.get(src);
  if (currentlyDecoding) {
    // If we're already decoding at a higher quality level, don't downgrade
    const levels: LODLevel[] = ['small', 'medium', 'full'];
    if (levels.indexOf(currentlyDecoding) >= levels.indexOf(level)) return;
  }
  
  decodingImages.set(src, level);
  const worker = getImageWorker();
  const maxDim = LOD_LEVELS[level];
  worker.postMessage({ type: 'decode', id: src, maxDim });
}

// Release a bitmap when image is no longer visible
function releaseBitmap(src: string): void {
  const entry = decodedBitmaps.get(src);
  if (entry) {
    try { entry.bitmap.close(); } catch { /* ignore */ }
    decodedBitmaps.delete(src);
  }
  decodingImages.delete(src);
}

// Hook for on-demand image loading with LOD support
function useImageOnDemand(
  src: string,
  displayWidth: number,
  displayHeight: number,
  isVisible: boolean
): ImageBitmap | undefined {
  const [, forceUpdate] = useState(0);
  const neededLevel = getLODLevel(displayWidth, displayHeight);

  // Start loading blob and decode when visible
  useEffect(() => {
    if (!isVisible) return;
    
    // Request blob cache
    requestBlobCache(src);
    
    const handleCached = (e: CustomEvent) => {
      if (e.detail.id === src) {
        // Blob cached, now request decode at needed level
        requestDecode(src, neededLevel);
      }
    };
    
    const handleDecoded = (e: CustomEvent) => {
      if (e.detail.id === src) {
        forceUpdate((n) => n + 1);
      }
    };
    
    window.addEventListener('blob-cached', handleCached as EventListener);
    window.addEventListener('image-decoded', handleDecoded as EventListener);
    
    // If blob already cached, check if we need to decode/upgrade
    if (cachedBlobs.has(src)) {
      const existing = decodedBitmaps.get(src);
      if (!existing) {
        // No bitmap yet, request decode
        requestDecode(src, neededLevel);
      } else {
        // Check if we need a higher resolution
        const levels: LODLevel[] = ['small', 'medium', 'full'];
        const currentIdx = levels.indexOf(existing.level);
        const neededIdx = levels.indexOf(neededLevel);
        if (neededIdx > currentIdx && !decodingImages.has(src)) {
          // Need higher resolution, request upgrade
          requestDecode(src, neededLevel);
        }
      }
    }
    
    return () => {
      window.removeEventListener('blob-cached', handleCached as EventListener);
      window.removeEventListener('image-decoded', handleDecoded as EventListener);
    };
  }, [src, isVisible, neededLevel]);

  // Release bitmap when no longer visible
  useEffect(() => {
    if (!isVisible) {
      releaseBitmap(src);
    }
  }, [src, isVisible]);

  const entry = decodedBitmaps.get(src);
  return isVisible ? entry?.bitmap : undefined;
}

// Selection rectangle for rubber band selection
interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Individual image component
interface CanvasImageNodeProps {
  image: CanvasImage;
  isSelected: boolean;
  onSelect: (shiftKey: boolean) => void;
  onDragStart: () => void;
  onDragMove: (id: string, x: number, y: number) => void;
  onDragEnd: (id: string, newX: number, newY: number) => void;
  activeTool: ToolType;
  scale: number;
  nodeRef?: (node: Konva.Image | null) => void;
}

function CanvasImageNode({
  image,
  isSelected,
  onSelect,
  onDragStart,
  onDragMove,
  onDragEnd,
  activeTool,
  scale,
  nodeRef,
}: CanvasImageNodeProps) {
  const shapeRef = useRef<Konva.Image>(null);

  const displayWidth = image.width * scale;
  const displayHeight = image.height * scale;

  // isVisible is always true since this component is only rendered for visible images
  const bitmap = useImageOnDemand(image.src, displayWidth, displayHeight, true);

  useEffect(() => {
    if (nodeRef) nodeRef(shapeRef.current);
  }, [nodeRef, bitmap]);

  const handleClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (activeTool === 'select') {
      onSelect(e.evt.shiftKey);
    }
  };

  const handleDragStart = () => {
    onDragStart();
  };

  const handleDragMove = (e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target;
    onDragMove(image.id, node.x(), node.y());
  };

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target;
    onDragEnd(image.id, node.x(), node.y());
  };

  const isDraggable = activeTool === 'select';

  if (!bitmap) {
    return (
      <Rect
        x={image.x}
        y={image.y}
        width={image.width}
        height={image.height}
        fill="rgba(100, 100, 100, 0.3)"
        stroke={isSelected ? '#4ade80' : 'rgba(150, 150, 150, 0.5)'}
        strokeWidth={isSelected ? 2 : 1}
        draggable={isDraggable}
        onClick={handleClick}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
      />
    );
  }

  return (
    <KonvaImage
      ref={shapeRef}
      id={image.id}
      image={bitmap}
      x={image.x}
      y={image.y}
      width={image.width}
      height={image.height}
      draggable={isDraggable}
      onClick={handleClick}
      onTap={() => onSelect(false)}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      stroke={isSelected ? '#4ade80' : undefined}
      strokeWidth={isSelected ? 2 / scale : 0}
    />
  );
}

// Grid layer
interface GridLayerProps {
  width: number;
  height: number;
  gridSize: number;
  stageX: number;
  stageY: number;
  scale: number;
}

function GridLayer({ width, height, gridSize, stageX, stageY, scale }: GridLayerProps) {
  const [gridBitmap, setGridBitmap] = useState<ImageBitmap | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const pendingRef = useRef(false);
  const lastParamsRef = useRef({ width: 0, height: 0, gridSize: 0, stageX: 0, stageY: 0, scale: 1 });

  const throttledParams = useMemo(
    () => ({
      width,
      height,
      gridSize,
      stageX: Math.round(stageX / 5) * 5,
      stageY: Math.round(stageY / 5) * 5,
      scale: Math.round(scale * 100) / 100,
    }),
    [width, height, gridSize, Math.round(stageX / 5), Math.round(stageY / 5), Math.round(scale * 100)]
  );

  useEffect(() => {
    if (!workerRef.current) {
      workerRef.current = createGridWorker()
      workerRef.current.onmessage = (e) => {
        if (e.data.type === 'rendered' && e.data.bitmap) {
          setGridBitmap(e.data.bitmap);
          pendingRef.current = false;
        }
      };
    }

    const last = lastParamsRef.current;
    if (
      last.width === throttledParams.width &&
      last.height === throttledParams.height &&
      last.gridSize === throttledParams.gridSize &&
      last.stageX === throttledParams.stageX &&
      last.stageY === throttledParams.stageY &&
      last.scale === throttledParams.scale
    )
      return;

    lastParamsRef.current = { ...throttledParams };
    if (pendingRef.current || !workerRef.current) return;

    pendingRef.current = true;
    workerRef.current.postMessage({ type: 'render', ...throttledParams });
  }, [throttledParams]);

  useEffect(
    () => () => {
      workerRef.current?.terminate();
    },
    []
  );

  if (!gridBitmap) return null;

  return (
    <KonvaImage
      image={gridBitmap}
      x={-stageX / scale}
      y={-stageY / scale}
      width={width / scale}
      height={height / scale}
      listening={false}
    />
  );
}

export const Canvas = memo(function Canvas({ wasm, activeTool, gridSize, onStatsUpdate }: CanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // Use shared camera state from context
  const camera = useCamera();
  const { scale, stagePos, setScale, setStagePos } = camera;
  
  const [selectionRect, setSelectionRect] = useState<SelectionRect | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const selectionStartRef = useRef<{ x: number; y: number } | null>(null);
  const lastFrameTime = useRef(0);
  const animationIdRef = useRef(0);
  const wasmInitializedRef = useRef(false);
  const imageNodesRef = useRef<Map<string, Konva.Image | null>>(new Map());
  
  // Color sorting state
  const colorSortedRef = useRef(false);
  const [colorsLoaded, setColorsLoaded] = useState(0);
  const totalImagesRef = useRef(0);

  // WASM-backed state
  const { images, stateVersion } = useCanvasStore();
  const { moveObject, resizeObject, batchMoveObjects, batchResizeObjects, deleteObject, deleteObjects } = useCanvasActions(wasm);

  // Force re-render of visible images and selection when state version changes
  useEffect(() => {
    // Clear selection for deleted items
    setSelectedIds((prev) => {
      const existingIds = new Set(images.map((img) => img.id));
      return prev.filter((id) => existingIds.has(id));
    });
  }, [stateVersion, images]);

  // Undo/Redo keyboard shortcuts
  useUndoRedoShortcuts(wasm, () => {
    // Selection might reference deleted objects after undo/redo
    setSelectedIds((prev) => {
      const existingIds = new Set(images.map((img) => img.id));
      return prev.filter((id) => existingIds.has(id));
    });
  });

  // Sync Konva camera state to global camera state whenever it changes
  useEffect(() => {
    // Update global camera state to match Konva's state
    // This allows StatsPanel and other components to read the current zoom
    updateCameraState({ zoom: scale, x: stagePos.x, y: stagePos.y });
  }, [scale, stagePos]);

  // Viewport culling
  const visibleImages = useMemo(() => {
    const padding = 200;
    const worldLeft = -stagePos.x / scale - padding;
    const worldTop = -stagePos.y / scale - padding;
    const worldRight = worldLeft + dimensions.width / scale + padding * 2;
    const worldBottom = worldTop + dimensions.height / scale + padding * 2;

    return images.filter((img) => {
      const imgRight = img.x + img.width;
      const imgBottom = img.y + img.height;
      return !(imgRight < worldLeft || img.x > worldRight || imgBottom < worldTop || img.y > worldBottom);
    });
  }, [images, stagePos.x, stagePos.y, scale, dimensions.width, dimensions.height]);

  // Update transformer when selection changes
  useEffect(() => {
    if (!transformerRef.current) return;

    const nodes: Konva.Node[] = [];
    selectedIds.forEach((id) => {
      const node = imageNodesRef.current.get(id);
      if (node) nodes.push(node);
    });

    transformerRef.current.nodes(nodes);
    transformerRef.current.getLayer()?.batchDraw();
  }, [selectedIds, visibleImages]);

  // Dimensions
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({ width: Math.floor(rect.width), height: Math.floor(rect.height) });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Initialize WASM and images
  useEffect(() => {
    if (!wasm || wasmInitializedRef.current) return;
    wasmInitializedRef.current = true;
    
    // Clear any existing state
    clearAssetRegistry();
    wasm.createCanvas(dimensions.width, dimensions.height, gridSize);

    const IMAGE_COUNT = 2000;
    const COLS = 50;
    
    // Store total for color sorting
    totalImagesRef.current = IMAGE_COUNT;
    const IMAGE_WIDTH = snapToGrid(400, gridSize);
    const IMAGE_HEIGHT = snapToGrid(300, gridSize);
    const GAP = snapToGrid(50, gridSize);
    const CELL_WIDTH = IMAGE_WIDTH + GAP;
    const CELL_HEIGHT = IMAGE_HEIGHT + GAP;

    const imageSizes = [
      { w: 1920, h: 1080 },
      { w: 1600, h: 900 },
      { w: 1280, h: 720 },
      { w: 1024, h: 768 },
    ];

    const offsetX = snapToGrid(-(COLS * CELL_WIDTH) / 2, gridSize);
    const offsetY = snapToGrid(-(Math.ceil(IMAGE_COUNT / COLS) * CELL_HEIGHT) / 2, gridSize);

    // Add all images via WASM
    for (let i = 0; i < IMAGE_COUNT; i++) {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const src = `https://picsum.photos/seed/cloudgrid${i}/${imageSizes[i % imageSizes.length].w}/${imageSizes[i % imageSizes.length].h}`;
      const assetId = registerAsset(src);
      
      wasm.addObject(
        offsetX + col * CELL_WIDTH,
        offsetY + row * CELL_HEIGHT,
        IMAGE_WIDTH,
        IMAGE_HEIGHT,
        assetId,
        1 // objectType: image
      );
    }

    // Sync state from WASM to React
    syncFromWasm(wasm);
    
    // Preload all image blobs to extract colors for sorting
    // This happens in the background without blocking rendering
    getImageWorker(); // Ensure worker is initialized
    
    for (let i = 0; i < IMAGE_COUNT; i++) {
      const src = `https://picsum.photos/seed/cloudgrid${i}/${imageSizes[i % imageSizes.length].w}/${imageSizes[i % imageSizes.length].h}`;
      requestBlobCache(src);
    }
  }, [wasm, dimensions.width, dimensions.height, gridSize]);

  // FPS counter
  useEffect(() => {
    const updateStats = (time: number) => {
      if (lastFrameTime.current) {
        const delta = time - lastFrameTime.current;
        const fps = Math.round(1000 / delta);
        onStatsUpdate(visibleImages.length, images.length, fps);
      }
      lastFrameTime.current = time;
      animationIdRef.current = requestAnimationFrame(updateStats);
    };
    animationIdRef.current = requestAnimationFrame(updateStats);
    return () => cancelAnimationFrame(animationIdRef.current);
  }, [visibleImages.length, images.length, onStatsUpdate]);

  // Track color loading progress
  useEffect(() => {
    const handleColorReady = () => {
      setColorsLoaded(imageColors.size);
    };
    
    window.addEventListener('image-color-ready', handleColorReady as EventListener);
    return () => window.removeEventListener('image-color-ready', handleColorReady as EventListener);
  }, []);

  // Function to sort images by color (exposed via custom event)
  const sortImagesByColor = useCallback(() => {
    if (!wasm) {
      return;
    }
    if (totalImagesRef.current === 0 || colorsLoaded < totalImagesRef.current) {
      return;
    }
    
    const IMAGE_COUNT = totalImagesRef.current;
    const COLS = 50;
    const ROWS = Math.ceil(IMAGE_COUNT / COLS);
    
    // Calculate color score for each image: (R - G) / (R + G + B + 1)
    // Higher = more red, Lower = more green, Middle = more blue
    const imageScores: Array<{ id: string; src: string; score: number; originalIdx: number }> = [];
    
    images.forEach((img, idx) => {
      const color = imageColors.get(img.src);
      if (color) {
        const { r, g, b } = color;
        const score = (r - g) / (r + g + b + 1);
        imageScores.push({ id: img.id, src: img.src, score, originalIdx: idx });
      }
    });
    
    // Sort by score (highest/reddest first)
    imageScores.sort((a, b) => b.score - a.score);
    
    // Create position mapping based on diagonal index
    // diagIdx = row + (maxCol - col), lower = top-right (reddest), higher = bottom-left (greenest)
    const positions: Array<{ row: number; col: number; diagIdx: number }> = [];
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const idx = row * COLS + col;
        if (idx >= IMAGE_COUNT) break;
        const diagIdx = row + (COLS - 1 - col);
        positions.push({ row, col, diagIdx });
      }
    }
    
    // Sort positions by diagonal index (ascending = top-right first)
    positions.sort((a, b) => a.diagIdx - b.diagIdx);
    
    // Calculate new positions
    const IMAGE_WIDTH = snapToGrid(400, gridSize);
    const IMAGE_HEIGHT = snapToGrid(300, gridSize);
    const GAP = snapToGrid(50, gridSize);
    const CELL_WIDTH = IMAGE_WIDTH + GAP;
    const CELL_HEIGHT = IMAGE_HEIGHT + GAP;
    const offsetX = snapToGrid(-(COLS * CELL_WIDTH) / 2, gridSize);
    const offsetY = snapToGrid(-(ROWS * CELL_HEIGHT) / 2, gridSize);
    
    // Map sorted images to sorted positions
    const moves: Array<{ id: string; numericId: number; newX: number; newY: number }> = [];
    
    imageScores.forEach((imgScore, sortedIdx) => {
      if (sortedIdx >= positions.length) return;
      const pos = positions[sortedIdx];
      const newX = offsetX + pos.col * CELL_WIDTH;
      const newY = offsetY + pos.row * CELL_HEIGHT;
      const numericId = getNumericId(imgScore.id);
      
      if (numericId !== null) {
        moves.push({ id: imgScore.id, numericId, newX, newY });
      }
    });
    
    // Animate moves using Konva
    const animationDuration = 1.5; // seconds
    
    moves.forEach((move) => {
      const node = imageNodesRef.current.get(move.id);
      if (node) {
        // Animate the Konva node
        node.to({
          x: move.newX,
          y: move.newY,
          duration: animationDuration,
          easing: Konva.Easings.EaseInOut,
          onFinish: () => {
            // Update WASM state after animation completes
            wasm.moveObject(move.numericId, move.newX, move.newY);
          },
        });
      } else {
        // Node not visible, update WASM directly
        wasm.moveObject(move.numericId, move.newX, move.newY);
      }
    });
    
    // Sync state after a delay to ensure animations complete
    setTimeout(() => {
      syncFromWasm(wasm);
    }, animationDuration * 1000 + 100);
  }, [wasm, colorsLoaded, images, gridSize]);

  // Listen for color sort event from StatsPanel
  useEffect(() => {
    const handleSortByColor = () => {
      sortImagesByColor();
    };
    
    window.addEventListener('sort-by-color', handleSortByColor);
    return () => window.removeEventListener('sort-by-color', handleSortByColor);
  }, [sortImagesByColor]);

  // File input ref for image upload
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Handle file upload with aspect ratio preservation
  const handleFileUpload = useCallback(async (files: FileList | null) => {
    if (!wasm || !files || files.length === 0) return;
    
    // Find the bottommost image in the canvas
    const objectCount = wasm.getObjectCount();
    let maxBottomY = 0;
    
    for (let i = 0; i < objectCount; i++) {
      const id = wasm.getObjectIdAtIndex(i);
      if (wasm.objectExists(id)) {
        const y = wasm.getObjectY(id);
        const height = wasm.getObjectHeight(id);
        const bottom = y + height;
        if (bottom > maxBottomY) {
          maxBottomY = bottom;
        }
      }
    }
    
    const GAP = snapToGrid(50, gridSize);
    const MAX_HEIGHT = 400; // Max height for uploaded images
    const startY = snapToGrid(maxBottomY + GAP, gridSize);
    
    // Load all images to get their dimensions
    const imageDataArray: Array<{
      src: string;
      assetId: number;
      width: number;
      height: number;
      file: File;
    }> = [];
    
    for (const file of Array.from(files)) {
      if (!file.type.match(/^image\/(png|jpeg|jpg)$/)) {
        console.warn('Skipping non-image file:', file.name);
        continue;
      }
      
      // Create object URL and load image to get dimensions
      const src = URL.createObjectURL(file);
      
      try {
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = reject;
          img.src = src;
        });
        
        // Calculate scaled dimensions while maintaining aspect ratio
        const aspectRatio = img.width / img.height;
        let width = img.width;
        let height = img.height;
        
        // Scale down if too large
        if (height > MAX_HEIGHT) {
          height = MAX_HEIGHT;
          width = height * aspectRatio;
        }
        
        // Snap to grid
        width = snapToGrid(width, gridSize);
        height = snapToGrid(height, gridSize);
        
        const assetId = registerAsset(src);
        imageDataArray.push({ src, assetId, width, height, file });
      } catch (error) {
        console.warn('Failed to load image:', file.name, error);
        URL.revokeObjectURL(src);
      }
    }
    
    if (imageDataArray.length === 0) return;
    
    // Calculate total width for centering
    const totalWidth = imageDataArray.reduce((sum, img) => sum + img.width, 0) + 
                       GAP * (imageDataArray.length - 1);
    const centerX = 0;
    let currentX = snapToGrid(centerX - totalWidth / 2, gridSize);
    
    // Track newly added item IDs and bounds
    const newItemIds: string[] = [];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    // Add images to WASM
    imageDataArray.forEach((imgData) => {
      const x = currentX;
      const y = startY;
      
      // Add to WASM and get the ID
      const numericId = wasm.addObject(x, y, imgData.width, imgData.height, imgData.assetId, 0);
      const stringId = `img-${numericId}`;
      newItemIds.push(stringId);
      
      // Update bounds
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + imgData.width);
      maxY = Math.max(maxY, y + imgData.height);
      
      // Move to next position
      currentX += imgData.width + GAP;
    });
    
    syncFromWasm(wasm);
    
    // Select newly added items
    if (newItemIds.length > 0) {
      setSelectedIds(newItemIds);
      
      // Dispatch event to zoom to these items
      window.dispatchEvent(new CustomEvent('zoom-to-bounds', {
        detail: {
          x: minX,
          y: minY,
          width: maxX - minX,
          height: maxY - minY,
        }
      }));
    }
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [wasm, gridSize]);

  // Listen for add media event from StatsPanel
  useEffect(() => {
    const handleAddMedia = () => {
      // Trigger file input click
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }
    };
    
    window.addEventListener('add-media', handleAddMedia);
    return () => window.removeEventListener('add-media', handleAddMedia);
  }, []);

  // Listen for zoom-to-bounds event (triggered after adding media)
  useEffect(() => {
    const handleZoomToBounds = (e: Event) => {
      const customEvent = e as CustomEvent<{ x: number; y: number; width: number; height: number }>;
      if (customEvent.detail) {
        camera.zoomToFit(customEvent.detail, 100, 500); // 100px padding, 500ms duration
      }
    };
    
    window.addEventListener('zoom-to-bounds', handleZoomToBounds);
    return () => window.removeEventListener('zoom-to-bounds', handleZoomToBounds);
  }, [camera]);

  // Listen for select-items event (programmatic selection)
  useEffect(() => {
    const handleSelectItems = (e: Event) => {
      const customEvent = e as CustomEvent<{ ids: string[] }>;
      if (customEvent.detail?.ids) {
        setSelectedIds(customEvent.detail.ids);
      }
    };
    
    window.addEventListener('select-items', handleSelectItems);
    return () => window.removeEventListener('select-items', handleSelectItems);
  }, []);

  // Listen for zoom-to-selected event
  useEffect(() => {
    const handleZoomToSelected = () => {
      if (!wasm || selectedIds.length === 0) return;
      
      // Calculate bounds of selected items
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      
      selectedIds.forEach(id => {
        const numericId = getNumericId(id);
        if (numericId !== null && wasm.objectExists(numericId)) {
          const x = wasm.getObjectX(numericId);
          const y = wasm.getObjectY(numericId);
          const width = wasm.getObjectWidth(numericId);
          const height = wasm.getObjectHeight(numericId);
          
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x + width);
          maxY = Math.max(maxY, y + height);
        }
      });
      
      if (minX !== Infinity) {
        camera.zoomToFit({
          x: minX,
          y: minY,
          width: maxX - minX,
          height: maxY - minY,
        }, 100, 500);
      }
    };
    
    window.addEventListener('zoom-to-selected', handleZoomToSelected);
    return () => window.removeEventListener('zoom-to-selected', handleZoomToSelected);
  }, [wasm, selectedIds, camera]);

  // Listen for delete selected event from StatsPanel
  useEffect(() => {
    const handleDeleteSelected = () => {
      if (selectedIds.length === 0) return;
      
      // Convert string IDs to numeric IDs and delete
      const numericIds = selectedIds
        .map(id => getNumericId(id))
        .filter((id): id is number => id !== null);
      
      if (numericIds.length > 0) {
        deleteObjects(numericIds); // Use the hook's deleteObjects function
        setSelectedIds([]); // Clear selection
      }
    };
    
    window.addEventListener('delete-selected', handleDeleteSelected);
    return () => window.removeEventListener('delete-selected', handleDeleteSelected);
  }, [selectedIds, deleteObjects]);

  // Add image globally (for testing)
  useEffect(() => {
    (window as any).cloudGridAddImage = () => {
      if (!wasm) return;
      const seed = Math.floor(Math.random() * 1000);
      const src = `https://picsum.photos/seed/${seed}/1920/1080`;
      const assetId = registerAsset(src);
      wasm.addObject(
        snapToGrid(Math.random() * 2000 - 1000, gridSize),
        snapToGrid(Math.random() * 2000 - 1000, gridSize),
        snapToGrid(300, gridSize),
        snapToGrid(200, gridSize),
        assetId,
        1
      );
      syncFromWasm(wasm);
    };
  }, [wasm, gridSize]);

  // Handle image selection
  const handleImageSelect = useCallback((id: string, shiftKey: boolean) => {
    if (shiftKey) {
      setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
    } else {
      setSelectedIds([id]);
    }
  }, []);

  // Track initial positions for group drag
  const dragInitialPositionsRef = useRef<Map<string, { x: number; y: number }> | null>(null);

  // Handle drag start
  const handleDragStart = useCallback(() => {
    const positions = new Map<string, { x: number; y: number }>();
    selectedIds.forEach((id) => {
      const img = images.find((i) => i.id === id);
      if (img) {
        positions.set(id, { x: img.x, y: img.y });
      }
    });
    dragInitialPositionsRef.current = positions;
  }, [selectedIds, images]);

  // Handle drag move - sync other selected items
  const handleDragMove = useCallback(
    (draggedId: string, newX: number, newY: number) => {
      if (!dragInitialPositionsRef.current || selectedIds.length <= 1) return;
      if (!selectedIds.includes(draggedId)) return;

      const initialPos = dragInitialPositionsRef.current.get(draggedId);
      if (!initialPos) return;

      const dx = newX - initialPos.x;
      const dy = newY - initialPos.y;

      selectedIds.forEach((id) => {
        if (id !== draggedId) {
          const node = imageNodesRef.current.get(id);
          const nodeInitialPos = dragInitialPositionsRef.current?.get(id);
          if (node && nodeInitialPos) {
            node.x(nodeInitialPos.x + dx);
            node.y(nodeInitialPos.y + dy);
          }
        }
      });
    },
    [selectedIds]
  );

  // Handle drag end - commit to WASM
  const handleDragEnd = useCallback(
    (draggedId: string, newX: number, newY: number) => {
      if (!wasm) return;

      // For group selections, only process the first onDragEnd event
      // (Konva fires onDragEnd for each item in the selection)
      if (selectedIds.length > 1 && !dragInitialPositionsRef.current) {
        return; // Already processed by first event
      }

      if (selectedIds.length <= 1) {
        // Single item drag
        const numericId = getNumericId(draggedId);
        if (numericId > 0) {
          moveObject(numericId, snapToGrid(newX, gridSize), snapToGrid(newY, gridSize));
        }
        dragInitialPositionsRef.current = null;
        return;
      }

      // Group drag - at this point dragInitialPositionsRef.current is guaranteed non-null
      // (we checked earlier and returned if it was null for group selections)
      const draggedInitialPos = dragInitialPositionsRef.current!.get(draggedId);
      if (!draggedInitialPos) {
        dragInitialPositionsRef.current = null;
        return;
      }

      const totalDx = newX - draggedInitialPos.x;
      const totalDy = newY - draggedInitialPos.y;

      const finalPositions: Array<{ id: string; x: number; y: number }> = [];
      selectedIds.forEach((id) => {
        const initialPos = dragInitialPositionsRef.current?.get(id);
        if (initialPos) {
          finalPositions.push({
            id,
            x: initialPos.x + totalDx,
            y: initialPos.y + totalDy,
          });
        }
      });

      if (finalPositions.length === 0) {
        dragInitialPositionsRef.current = null;
        return;
      }

      const snapOffset = getGroupSnapOffset(finalPositions, gridSize);

      // Use batch move for group operations (single history entry)
      const moves = finalPositions
        .map((pos) => {
          const numericId = getNumericId(pos.id);
          if (numericId > 0) {
            return {
              objectId: numericId,
              x: pos.x + snapOffset.dx,
              y: pos.y + snapOffset.dy,
            };
          }
          return null;
        })
        .filter((m): m is { objectId: number; x: number; y: number } => m !== null);

      batchMoveObjects(moves);

      dragInitialPositionsRef.current = null;
    },
    [wasm, selectedIds, gridSize, moveObject, batchMoveObjects]
  );

  // Handle stage mouse down - start rubber band selection
  const handleStageMouseDown = useCallback(
    (e: Konva.KonvaEventObject<PointerEvent>) => {
      if (activeTool !== 'select') return;
      if (e.target !== e.target.getStage()) return;

      const stage = stageRef.current;
      if (!stage) return;

      const pos = stage.getPointerPosition();
      if (!pos) return;

      const worldX = (pos.x - stagePos.x) / scale;
      const worldY = (pos.y - stagePos.y) / scale;

      selectionStartRef.current = { x: worldX, y: worldY };
      setIsSelecting(true);
      setSelectionRect({ x: worldX, y: worldY, width: 0, height: 0 });

      if (!e.evt.shiftKey) {
        setSelectedIds([]);
      }
    },
    [activeTool, stagePos, scale]
  );

  // Handle stage mouse move
  const handleStageMouseMove = useCallback(
    (_e: Konva.KonvaEventObject<PointerEvent>) => {
      if (!isSelecting || !selectionStartRef.current) return;

      const stage = stageRef.current;
      if (!stage) return;

      const pos = stage.getPointerPosition();
      if (!pos) return;

      const worldX = (pos.x - stagePos.x) / scale;
      const worldY = (pos.y - stagePos.y) / scale;
      const start = selectionStartRef.current;

      setSelectionRect({
        x: Math.min(start.x, worldX),
        y: Math.min(start.y, worldY),
        width: Math.abs(worldX - start.x),
        height: Math.abs(worldY - start.y),
      });
    },
    [isSelecting, stagePos, scale]
  );

  // Handle stage mouse up
  const handleStageMouseUp = useCallback(
    (e: Konva.KonvaEventObject<PointerEvent>) => {
      if (!isSelecting || !selectionRect) {
        setIsSelecting(false);
        setSelectionRect(null);
        return;
      }

      const newSelectedIds: string[] = e.evt.shiftKey ? [...selectedIds] : [];

      images.forEach((img) => {
        const imgRight = img.x + img.width;
        const imgBottom = img.y + img.height;
        const rectRight = selectionRect.x + selectionRect.width;
        const rectBottom = selectionRect.y + selectionRect.height;

        if (!(imgRight < selectionRect.x || img.x > rectRight || imgBottom < selectionRect.y || img.y > rectBottom)) {
          if (!newSelectedIds.includes(img.id)) {
            newSelectedIds.push(img.id);
          }
        }
      });

      setSelectedIds(newSelectedIds);
      setIsSelecting(false);
      setSelectionRect(null);
      selectionStartRef.current = null;
    },
    [isSelecting, selectionRect, images, selectedIds]
  );

  // Handle stage click
  const handleStageClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      if (e.target === e.target.getStage() && !isSelecting && selectedIds.length > 0) {
        if (!selectionRect) {
          setSelectedIds([]);
        }
      }
    },
    [isSelecting, selectionRect, selectedIds]
  );

  // Handle wheel
  const handleWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      const stage = stageRef.current;
      if (!stage) return;

      if (e.evt.ctrlKey || e.evt.metaKey) {
        const oldScale = scale;
        const pointer = stage.getPointerPosition();
        if (!pointer) return;

        const scaleBy = 1.1;
        const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
        const clampedScale = Math.max(0.1, Math.min(10, newScale));

        const mousePointTo = {
          x: (pointer.x - stagePos.x) / oldScale,
          y: (pointer.y - stagePos.y) / oldScale,
        };

        setScale(clampedScale);
        setStagePos({
          x: pointer.x - mousePointTo.x * clampedScale,
          y: pointer.y - mousePointTo.y * clampedScale,
        });
      } else {
        setStagePos({
          x: stagePos.x - e.evt.deltaX,
          y: stagePos.y - e.evt.deltaY,
        });
      }
    },
    [scale, stagePos]
  );

  // Handle touch gestures (pinch-to-zoom)
  const lastTouchDistanceRef = useRef<number>(0);
  
  const handleTouchMove = useCallback(
    (e: Konva.KonvaEventObject<TouchEvent>) => {
      e.evt.preventDefault();
      const touch1 = e.evt.touches[0];
      const touch2 = e.evt.touches[1];

      if (touch1 && touch2) {
        // Pinch gesture detected
        const stage = stageRef.current;
        if (!stage) return;

        const dist = Math.hypot(
          touch2.clientX - touch1.clientX,
          touch2.clientY - touch1.clientY
        );

        if (lastTouchDistanceRef.current > 0) {
          const delta = dist / lastTouchDistanceRef.current;
          const oldScale = scale;
          const newScale = oldScale * delta;
          const clampedScale = Math.max(0.1, Math.min(10, newScale));

          // Get center point between two touches
          const centerX = (touch1.clientX + touch2.clientX) / 2;
          const centerY = (touch1.clientY + touch2.clientY) / 2;

          const rect = stage.container().getBoundingClientRect();
          const pointer = {
            x: centerX - rect.left,
            y: centerY - rect.top,
          };

          const mousePointTo = {
            x: (pointer.x - stagePos.x) / oldScale,
            y: (pointer.y - stagePos.y) / oldScale,
          };

          setScale(clampedScale);
          setStagePos({
            x: pointer.x - mousePointTo.x * clampedScale,
            y: pointer.y - mousePointTo.y * clampedScale,
          });
        }

        lastTouchDistanceRef.current = dist;
      }
    },
    [scale, stagePos]
  );

  const handleTouchEnd = useCallback(() => {
    lastTouchDistanceRef.current = 0;
  }, []);

  // Handle stage drag
  const handleStageDragEnd = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    if (e.target === e.target.getStage()) {
      setStagePos({ x: e.target.x(), y: e.target.y() });
    }
  }, []);

  // Handle transform end - commit resize to WASM
  const handleTransformEnd = useCallback(
    (_e: Konva.KonvaEventObject<Event>) => {
      if (!wasm) return;
      const transformer = transformerRef.current;
      if (!transformer) return;

      const minSize = gridSize * MIN_SIZE_MULTIPLIER;
      const maxSize = gridSize * MAX_SIZE_MULTIPLIER;

      const nodes = transformer.nodes();

      // Collect all resize operations
      const resizes: Array<{ objectId: number; x: number; y: number; width: number; height: number }> = [];

      nodes.forEach((node) => {
        const id = node.id();
        const numericId = getNumericId(id);
        if (numericId <= 0) return;

        const scaleX = node.scaleX();
        const scaleY = node.scaleY();

        node.scaleX(1);
        node.scaleY(1);

        let newWidth = snapToGrid(node.width() * scaleX, gridSize);
        let newHeight = snapToGrid(node.height() * scaleY, gridSize);

        newWidth = Math.max(minSize, Math.min(maxSize, newWidth));
        newHeight = Math.max(minSize, Math.min(maxSize, newHeight));

        resizes.push({
          objectId: numericId,
          x: snapToGrid(node.x(), gridSize),
          y: snapToGrid(node.y(), gridSize),
          width: newWidth,
          height: newHeight,
        });
      });

      // Use batch resize for group operations (single history entry)
      // or single resize for individual items
      if (resizes.length === 1) {
        const r = resizes[0];
        resizeObject(r.objectId, r.x, r.y, r.width, r.height);
      } else if (resizes.length > 1) {
        batchResizeObjects(resizes);
      }
    },
    [wasm, gridSize, resizeObject, batchResizeObjects]
  );

  // Keyboard shortcuts for delete and select all
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length > 0 && wasm) {
        selectedIds.forEach((id) => {
          const numericId = getNumericId(id);
          if (numericId > 0) {
            deleteObject(numericId);
          }
        });
        setSelectedIds([]);
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        setSelectedIds(images.map((img) => img.id));
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [wasm, selectedIds, images, deleteObject]);

  const cursorStyle = activeTool === 'pan' ? 'grab' : isSelecting ? 'crosshair' : 'default';

  return (
    <div ref={containerRef} style={{ position: 'absolute', inset: 0, overflow: 'hidden', cursor: cursorStyle }}>
      <Stage
        ref={stageRef}
        width={dimensions.width}
        height={dimensions.height}
        x={stagePos.x}
        y={stagePos.y}
        scaleX={scale}
        scaleY={scale}
        draggable={activeTool === 'pan'}
        onClick={handleStageClick}
        onTap={handleStageClick}
        onWheel={handleWheel}
        onDragEnd={handleStageDragEnd}
        onPointerDown={handleStageMouseDown}
        onPointerMove={handleStageMouseMove}
        onPointerUp={handleStageMouseUp}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ backgroundColor: 'oklch(0.09 0.01 255)' }}
      >
        {/* Grid layer */}
        <Layer listening={false}>
          <GridLayer
            width={dimensions.width}
            height={dimensions.height}
            gridSize={gridSize}
            stageX={stagePos.x}
            stageY={stagePos.y}
            scale={scale}
          />
        </Layer>

        {/* Images layer */}
        <Layer>
          {visibleImages.map((img) => (
            <CanvasImageNode
              key={img.id}
              image={img}
              isSelected={selectedIds.includes(img.id)}
              onSelect={(shiftKey) => handleImageSelect(img.id, shiftKey)}
              onDragStart={handleDragStart}
              onDragMove={handleDragMove}
              onDragEnd={handleDragEnd}
              activeTool={activeTool}
              scale={scale}
              nodeRef={(node) => {
                if (node) imageNodesRef.current.set(img.id, node);
                else imageNodesRef.current.delete(img.id);
              }}
            />
          ))}

          {/* Transformer for selected items */}
          <Transformer
            ref={transformerRef}
            flipEnabled={false}
            boundBoxFunc={(oldBox, newBox) => {
              const minSize = gridSize * MIN_SIZE_MULTIPLIER;
              const maxSize = gridSize * MAX_SIZE_MULTIPLIER;

              if (Math.abs(newBox.width) < minSize || Math.abs(newBox.height) < minSize) {
                return oldBox;
              }
              if (Math.abs(newBox.width) > maxSize || Math.abs(newBox.height) > maxSize) {
                return oldBox;
              }
              return newBox;
            }}
            keepRatio={true}
            enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
            anchorFill="#4ade80"
            anchorStroke="#22c55e"
            anchorSize={10}
            anchorCornerRadius={2}
            borderStroke="#4ade80"
            borderStrokeWidth={2}
            onTransformEnd={handleTransformEnd}
          />

          {/* Selection rectangle */}
          {selectionRect && (
            <Rect
              x={selectionRect.x}
              y={selectionRect.y}
              width={selectionRect.width}
              height={selectionRect.height}
              fill="rgba(74, 222, 128, 0.1)"
              stroke="#4ade80"
              strokeWidth={1 / scale}
              dash={[5 / scale, 5 / scale]}
            />
          )}
        </Layer>
      </Stage>

      {/* Selection info */}
      {selectedIds.length > 1 && (
        <div className="absolute bottom-4 left-4 px-3 py-1.5 bg-card/90 backdrop-blur-sm rounded-md text-sm text-foreground border border-border">
          {selectedIds.length} items selected
        </div>
      )}

      {/* Undo/Redo hint */}
      <div className="absolute bottom-4 right-4 px-3 py-1.5 bg-card/90 backdrop-blur-sm rounded-md text-xs text-muted-foreground border border-border">
        <span className="text-accent">Ctrl+Z</span> Undo • <span className="text-accent">Ctrl+Shift+Z</span> Redo
      </div>

      {/* Hidden file input for image upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => handleFileUpload(e.target.files)}
      />
    </div>
  );
});
