import type { ToolType } from '@convadraw/state'
import Konva from 'konva'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Layer, Rect, Stage, Transformer } from 'react-konva'
import { useCamera } from '../CameraContext'
import { updateCameraState } from '../hooks/useCameraState'
import {
  getAssetMetadata,
  getAssetStringId,
  getNumericId,
  registerAsset,
  setAssetMetadata,
  syncFromWasm,
  updateAssetColor,
  useCanvasActions,
  useCanvasStore,
  useUndoRedoShortcuts,
} from '../hooks/useCanvasStore'
import { getGroupSnapOffset, snapDimensionsToGrid, snapToGrid } from '../lib/grid-utils'
import { getImageWorker } from '../lib/imageLoading'
import { generateAssetId, type ImageAsset } from '../types/assets'
import type { WASMExports } from '../utils/wasmLoader'

// Import components
import { CanvasImageNode } from './CanvasImageNode'
import { MAX_SIZE_MULTIPLIER, MIN_SIZE_MULTIPLIER, type SelectionRect } from './constants'
import { GridLayer } from './GridLayer'

// Import Hammer.js for touch gestures
import Hammer from '../lib/hammer'
import TouchEmulator from '../lib/touch-emulator'

interface CanvasProps {
  wasm: WASMExports | null;
  activeTool: ToolType;
  gridSize: number;
  onStatsUpdate: (visible: number, total: number, fps: number) => void;
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

  // Refs and state for gesture handling
  const activeToolRef = useRef<ToolType>(activeTool);
  const [isPinching, setIsPinching] = useState(false);
  const isPinchingRef = useRef(false); // Keep a ref in sync for use in callbacks

  // WASM-backed state
  const { images, stateVersion } = useCanvasStore();
  const { moveObject, resizeObject, batchMoveObjects, batchResizeObjects, deleteObject, deleteObjects } = useCanvasActions(wasm);

  // Keep refs in sync with props and state
  useEffect(() => {
    activeToolRef.current = activeTool;
  }, [activeTool]);

  useEffect(() => {
    isPinchingRef.current = isPinching;
  }, [isPinching]);

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

  // Sync WASM state to React on mount (assets are already added by CloudGrid)
  useEffect(() => {
    if (!wasm || wasmInitializedRef.current) return;
    wasmInitializedRef.current = true;
    
    // Sync state from WASM to React
    syncFromWasm(wasm);
    
    // Initialize worker for image loading
    getImageWorker();
  }, [wasm]);

  useEffect(() => {
    activeToolRef.current = activeTool;
  }, [activeTool]);

  // Initialize Hammer.js for touch gestures
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    // Enable touch emulator for desktop testing (Shift key to emulate touch)
    if (process.env.NODE_ENV === 'development') {
      try {
        TouchEmulator();
      } catch (e) {
        console.warn('TouchEmulator already initialized');
      }
    }

    // Set Konva flags for gesture support
    Konva.hitOnDragEnabled = true;
    Konva.capturePointerEventsEnabled = true;

    // Initialize Hammer with domEvents option for Konva compatibility
    const hammer = new Hammer(stage, { domEvents: false });
    hammerRef.current = hammer;

    // Enable pinch gesture
    hammer.get('pinch').set({ enable: true });
    hammer.get('pan').set({ direction: Hammer.DIRECTION_ALL, threshold: 0 });

    // Handle pan gesture (replaces draggable stage)
    let panStartPos: { x: number; y: number } | null = null;
    
    hammer.on('panstart', (e: any) => {
      panStartPos = e.target?.attrs ? { x: e.target.attrs.x, y: e.target.attrs.y } : null;
    });
    hammer.on('pan', (e: any) => {
      if (activeToolRef.current !== 'pan') return;
      if (!panStartPos) {
        panStartPos = e.target?.attrs ? { x: e.target.attrs.x, y: e.target.attrs.y } : null;
        return;
      };

      const delta = {
        x: isNaN(e.deltaX) ? 0 : e.deltaX,
        y: isNaN(e.deltaY) ? 0 : e.deltaY,
      };
      
      setStagePos({
        x: panStartPos.x + delta.x,
        y: panStartPos.y + delta.y,
      });
    });
    hammer.on('panend', () => {
      panStartPos = null;
    });

    // Handle pinch gesture (zoom)
    let pinchStartScale = 1;
    let pinchStartPos: { x: number; y: number } | null = null;
    let pinchCenter = { x: 0, y: 0 };

    hammer.on('pinchstart', (e: any) => {
      setIsPinching(true); // Update state to disable draggable
      isPinchingRef.current = true; // Update ref for immediate access in callbacks
      pinchStartScale = e.target.attrs.scaleX;
      pinchStartPos = { x: e.target.attrs.x, y: e.target.attrs.y };
      // Get pinch center in stage coordinates
      const stageBox = stage.container().getBoundingClientRect();
      pinchCenter = {
        x: e.center.x - stageBox.left,
        y: e.center.y - stageBox.top,
      };
    });

    hammer.on('pinchmove', (e: any) => {
      if(!pinchStartPos) {
        pinchStartPos = e.target?.attrs ? { x: e.target.attrs.x, y: e.target.attrs.y } : null;
        return;
      };
      const newScale = Math.max(0.1, Math.min(10, pinchStartScale * e.scale));
      
      // Calculate zoom point
      const mousePointTo = {
        x: (pinchCenter.x - pinchStartPos.x) / pinchStartScale,
        y: (pinchCenter.y - pinchStartPos.y) / pinchStartScale,
      };

      setScale(newScale);
      setStagePos({
        x: pinchCenter.x - mousePointTo.x * newScale,
        y: pinchCenter.y - mousePointTo.y * newScale,
      });
    });

    hammer.on('pinchend', () => {
      pinchStartPos = null;
      setIsPinching(false); // Update state to re-enable draggable
      isPinchingRef.current = false; // Update ref for immediate access in callbacks
    });

    return () => {
      if (hammerRef.current) {
        hammerRef.current.destroy();
        hammerRef.current = null;
      }
    };
  }, []); // Re-initialize when scale/pos change to capture latest values

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
  // Track image color loading and store in asset metadata
  useEffect(() => {
    const handleColorReady = (e: Event) => {
      const customEvent = e as CustomEvent<{ id: string; color: { r: number; g: number; b: number } }>;
      const { id, color } = customEvent.detail;
      
      // Store color data in asset metadata
      updateAssetColor(id, color);
    };
    
    window.addEventListener('image-color-ready', handleColorReady as EventListener);
    return () => window.removeEventListener('image-color-ready', handleColorReady as EventListener);
  }, []);

  // Normalize specific items to target height while maintaining aspect ratios
  const normalizeItemHeights = useCallback((itemIds?: number[], targetHeight?: number): number => {
    if (!wasm) return 0;
    
    const objectCount = wasm.getObjectCount();
    if (objectCount === 0) return 0;
    
    // If no specific items provided, normalize all items
    const idsToNormalize = itemIds || [];
    const normalizeAll = !itemIds || itemIds.length === 0;
    
    // Calculate average height if not provided
    let avgHeight = targetHeight || 0;
    const itemData: Array<{ id: number; width: number; height: number; x: number; y: number }> = [];
    
    if (avgHeight === 0) {
      // Calculate average from all items
      let totalHeight = 0;
      let count = 0;
      
      for (let i = 0; i < objectCount; i++) {
        const id = wasm.getObjectIdAtIndex(i);
        if (wasm.objectExists(id)) {
          totalHeight += wasm.getObjectHeight(id);
          count++;
        }
      }
      
      avgHeight = count > 0 ? totalHeight / count : 350;
    }
    
    // Collect items to normalize
    if (normalizeAll) {
      for (let i = 0; i < objectCount; i++) {
        const id = wasm.getObjectIdAtIndex(i);
        if (wasm.objectExists(id)) {
          itemData.push({
            id,
            width: wasm.getObjectWidth(id),
            height: wasm.getObjectHeight(id),
            x: wasm.getObjectX(id),
            y: wasm.getObjectY(id),
          });
        }
      }
    } else {
      idsToNormalize.forEach(id => {
        if (wasm.objectExists(id)) {
          itemData.push({
            id,
            width: wasm.getObjectWidth(id),
            height: wasm.getObjectHeight(id),
            x: wasm.getObjectX(id),
            y: wasm.getObjectY(id),
          });
        }
      });
    }
    
    if (itemData.length === 0) return avgHeight;
    
    // Calculate new dimensions for each item
    const resizes: Array<{ 
      id: number; 
      oldX: number; 
      oldY: number; 
      oldWidth: number; 
      oldHeight: number;
      newX: number; 
      newY: number; 
      newWidth: number; 
      newHeight: number 
    }> = [];
    
    itemData.forEach(item => {
      const aspectRatio = item.width / item.height;
      const { width: newWidth, height: newHeight } = snapDimensionsToGrid(
        avgHeight,
        aspectRatio,
        gridSize
      );
      
      // Only resize if dimensions actually changed
      if (newWidth !== item.width || newHeight !== item.height) {
        resizes.push({ 
          id: item.id, 
          oldX: item.x, 
          oldY: item.y, 
          oldWidth: item.width, 
          oldHeight: item.height,
          newX: item.x, 
          newY: item.y, 
          newWidth, 
          newHeight 
        });
      }
    });
    
    if (resizes.length === 0) return avgHeight;
    
    // Process in batches of 100 to avoid WASM stack overflow
    const BATCH_SIZE = 100;
    try {
      for (let i = 0; i < resizes.length; i += BATCH_SIZE) {
        const batch = resizes.slice(i, i + BATCH_SIZE);
        
        wasm.beginBatchResize();
        batch.forEach(resize => {
          wasm.addToBatchResize(
            resize.id, 
            resize.oldX, 
            resize.oldY, 
            resize.oldWidth, 
            resize.oldHeight,
            resize.newX, 
            resize.newY, 
            resize.newWidth, 
            resize.newHeight
          );
        });
        wasm.endBatchResize();
      }
      
      syncFromWasm(wasm);
    } catch (error) {
      console.error('Failed to normalize item heights:', error);
      throw error;
    }
    
    return avgHeight;
  }, [wasm, gridSize]);

  // Function to sort images by color (exposed via custom event)
  // Supports sorting selected images or all images
  const sortImagesByColor = useCallback(() => {
    if (!wasm) {
      return;
    }
    
    // Determine which images to sort: selected or all
    const imagesToSort = selectedIds.length > 0 
      ? images.filter((img) => selectedIds.includes(img.id))
      : images;
    
    if (imagesToSort.length === 0) {
      console.warn('No images to sort');
      return;
    }
    
    // Check if all images have color data
    const imagesWithColor = imagesToSort.filter((img) => {
      const numericId = getNumericId(img.id);
      if (!numericId) return false;
      const assetStringId = getAssetStringId(numericId);
      if (!assetStringId) return false;
      const metadata = getAssetMetadata(assetStringId);
      return metadata?.colorScore !== undefined;
    });
    
    if (imagesWithColor.length === 0) {
      console.warn('No color data available for images. Please wait for images to load.');
      return;
    }
    
    if (imagesWithColor.length < imagesToSort.length) {
      console.warn(
        `Color data available for ${imagesWithColor.length}/${imagesToSort.length} images. ` +
        `Sorting ${imagesWithColor.length} images.`
      );
    }
    
    // Get numeric IDs for images to normalize
    const itemIds = imagesWithColor.map((img) => getNumericId(img.id)).filter((id): id is number => id !== null && id !== 0);
    
    // Normalize heights for items being sorted (this is a batch operation)
    let avgHeight = 0;
    try {
      avgHeight = normalizeItemHeights(itemIds);
      if (avgHeight === 0) return;
    } catch (error) {
      console.error('Failed to normalize heights during color sort:', error);
      return;
    }
    
    // Get color scores from asset metadata
    const imageScores: Array<{ id: string; src: string; score: number; originalIdx: number; assetId: string; width: number; height: number }> = [];
    
    imagesWithColor.forEach((img, idx) => {
      const numericId = getNumericId(img.id);
      if (!numericId) return;
      const assetStringId = getAssetStringId(numericId);
      if (!assetStringId) return;
      const metadata = getAssetMetadata(assetStringId);
      if (metadata?.colorScore !== undefined) {
        imageScores.push({ 
          id: img.id, 
          src: img.src, 
          score: metadata.colorScore, 
          originalIdx: idx,
          assetId: assetStringId,
          width: img.width,
          height: img.height
        });
      }
    });
    
    // Sort by score (highest/reddest first)
    imageScores.sort((a, b) => b.score - a.score);
    
    // Calculate start position (below bottommost image for group sort, or centered for all)
    const normalizedHeight = snapToGrid(avgHeight, gridSize);
    const GAP = snapToGrid(50, gridSize);
    
    let startY = 0;
    let startX = 0;
    
    if (selectedIds.length > 0) {
      // Group sort: position below bottommost image
      let maxBottomY = -Infinity;
      for (let i = 0; i < wasm.getObjectCount(); i++) {
        const id = wasm.getObjectIdAtIndex(i);
        if (wasm.objectExists(id)) {
          const y = wasm.getObjectY(id);
          const height = wasm.getObjectHeight(id);
          maxBottomY = Math.max(maxBottomY, y + height);
        }
      }
      startY = snapToGrid(maxBottomY + GAP * 2, gridSize);
      startX = 0; // Centered
    } else {
      // Sort all: use centered layout
      startX = 0;
      startY = 0;
    }
    
    // Create masonry layout with fixed height, variable width
    const MAX_ROW_WIDTH = 8000; // Max width per row before wrapping
    const rows: Array<Array<{ id: string; numericId: number; width: number; height: number; x: number; y: number }>> = [];
    let currentRow: Array<{ id: string; numericId: number; width: number; height: number; x: number; y: number }> = [];
    let currentRowWidth = 0;
    
    imageScores.forEach((imgScore) => {
      const numericId = getNumericId(imgScore.id);
      if (!numericId) return;
      
      // Get current dimensions from WASM (after normalization)
      const currentWidth = wasm.getObjectWidth(numericId);
      const currentHeight = wasm.getObjectHeight(numericId);
      
      // Calculate width for normalized height (masonry: fixed height, variable width)
      const aspectRatio = currentWidth / currentHeight;
      const newWidth = snapToGrid(normalizedHeight * aspectRatio, gridSize);
      
      // Check if adding this image would exceed max row width
      if (currentRow.length > 0 && currentRowWidth + GAP + newWidth > MAX_ROW_WIDTH) {
        // Start new row
        rows.push(currentRow);
        currentRow = [];
        currentRowWidth = 0;
      }
      
      currentRow.push({
        id: imgScore.id,
        numericId,
        width: newWidth,
        height: normalizedHeight,
        x: 0, // Will be calculated below
        y: 0, // Will be calculated below
      });
      
      currentRowWidth += (currentRow.length > 1 ? GAP : 0) + newWidth;
    });
    
    // Add the last row
    if (currentRow.length > 0) {
      rows.push(currentRow);
    }
    
    // Calculate x,y positions for each row (centered) and create moves array
    const moves: Array<{ id: string; numericId: number; newX: number; newY: number; newWidth: number; newHeight: number }> = [];
    let currentY = startY;
    rows.forEach((row) => {
      // Calculate total width of this row (including gaps)
      const rowWidth = row.reduce((sum, item, idx) => sum + item.width + (idx > 0 ? GAP : 0), 0);
      const rowStartX = snapToGrid(startX - rowWidth / 2, gridSize);
      
      let currentX = rowStartX;
      row.forEach((item) => {
        item.x = currentX;
        item.y = currentY;
        
        moves.push({
          id: item.id,
          numericId: item.numericId,
          newX: item.x,
          newY: item.y,
          newWidth: item.width,
          newHeight: item.height,
        });
        
        currentX += item.width + GAP;
      });
      
      currentY += normalizedHeight + GAP;
    });
    
    // Calculate scaled animation duration based on item count
    // baseDuration = 1000ms, maxDuration = 3000ms, threshold = 1000 items
    const baseDuration = 1.0; // seconds
    const maxDuration = 3.0; // seconds
    const threshold = 1000;
    const scaledDuration = Math.min(
      baseDuration + (imageScores.length / threshold) * 1.0,
      maxDuration
    );
    
    // Update ALL items in WASM first with new positions and dimensions
    moves.forEach((move) => {
      // Resize to normalized height with correct aspect ratio
      wasm.resizeObject(move.numericId, move.newX, move.newY, move.newWidth, move.newHeight);
    });
    
    // Then animate visible Konva nodes (position AND dimensions)
    moves.forEach((move) => {
      const node = imageNodesRef.current.get(move.id);
      if (node) {
        // Get current state from Konva node
        const currentX = node.x();
        const currentY = node.y();
        const currentWidth = node.width();
        const currentHeight = node.height();
        
        // Animate if position or dimensions changed
        if (currentX !== move.newX || currentY !== move.newY || 
            currentWidth !== move.newWidth || currentHeight !== move.newHeight) {
          node.to({
            x: move.newX,
            y: move.newY,
            width: move.newWidth,
            height: move.newHeight,
            duration: scaledDuration,
            easing: Konva.Easings.EaseInOut,
          });
        }
      }
    });
    
    // Sync state after animation completes
    setTimeout(() => {
      syncFromWasm(wasm);
    }, scaledDuration * 1000 + 100);
  }, [wasm, images, selectedIds, gridSize, normalizeItemHeights]);

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
    
    // Calculate average height of existing items (or use default)
    const objectCount = wasm.getObjectCount();
    let totalHeight = 0;
    let maxBottomY = 0;
    
    for (let i = 0; i < objectCount; i++) {
      const id = wasm.getObjectIdAtIndex(i);
      if (wasm.objectExists(id)) {
        const height = wasm.getObjectHeight(id);
        const y = wasm.getObjectY(id);
        const bottom = y + height;
        
        totalHeight += height;
        if (bottom > maxBottomY) {
          maxBottomY = bottom;
        }
      }
    }
    
    // Use average height of existing items, or default to 350 if no items
    const avgHeight = objectCount > 0 ? totalHeight / objectCount : 350;
    const targetHeight = avgHeight;
    
    const GAP = snapToGrid(50, gridSize);
    const startY = snapToGrid(maxBottomY + GAP, gridSize);
    
    // Load all images and create Asset objects
    const newAssets: ImageAsset[] = [];
    
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
        
        // Store original dimensions
        const originalWidth = img.width;
        const originalHeight = img.height;
        const aspectRatio = originalWidth / originalHeight;
        
        // Snap dimensions to grid while maintaining aspect ratio
        const { width, height } = snapDimensionsToGrid(
          targetHeight,
          aspectRatio,
          gridSize
        );
        
        // Create Asset object with metadata (only intrinsic properties)
        const asset: ImageAsset = {
          id: generateAssetId(),
          type: 'image',
          x: 0, // Will be calculated after we know total width
          y: startY,
          w: width,  // Display width
          h: height, // Display height
          src,
          alt: file.name,
          // Metadata: ONLY intrinsic properties from the source file
          metadata: {
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            originalWidth,   // Original dimensions from file
            originalHeight,
            uploadedAt: new Date().toISOString(),
          },
        };
        
        newAssets.push(asset);
      } catch (error) {
        console.warn('Failed to load image:', file.name, error);
        URL.revokeObjectURL(src);
      }
    }
    
    if (newAssets.length === 0) return;
    
    // Calculate total width for centering
    const totalWidth = newAssets.reduce((sum, asset) => sum + asset.w, 0) + 
                       GAP * (newAssets.length - 1);
    const centerX = 0;
    let currentX = snapToGrid(centerX - totalWidth / 2, gridSize);
    
    // Update asset x positions for centered layout
    newAssets.forEach((asset) => {
      asset.x = currentX;
      currentX += asset.w + GAP;
    });
    
    // Track newly added item IDs and bounds
    const newItemIds: string[] = [];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    // Add assets to WASM and store metadata
    newAssets.forEach((asset) => {
      // Register the asset source with asset ID
      const numericAssetId = registerAsset(asset.src, asset.id);
      
      // Store asset metadata in registry (indexed by asset.id)
      if (asset.metadata) {
        setAssetMetadata(asset.id, asset.metadata, asset.src);
      }
      
      // Add to WASM and get the ID
      const numericId = wasm.addObject(asset.x, asset.y, asset.w, asset.h, numericAssetId, 1); // objectType 1 = image
      const stringId = `img-${numericId}`;
      newItemIds.push(stringId);
      
      // Update bounds
      minX = Math.min(minX, asset.x);
      minY = Math.min(minY, asset.y);
      maxX = Math.max(maxX, asset.x + asset.w);
      maxY = Math.max(maxY, asset.y + asset.h);
    });
    
    syncFromWasm(wasm);
    
    // Only normalize newly added items to match existing average height
    // (Don't normalize all 2000 items - too expensive)
    if (newItemIds.length > 0 && objectCount > newItemIds.length) {
      const newNumericIds = newItemIds
        .map(id => getNumericId(id))
        .filter((id): id is number => id !== null);
      
      // Calculate average height of EXISTING items (before we added new ones)
      let existingTotalHeight = 0;
      let existingCount = 0;
      for (let i = 0; i < objectCount; i++) {
        const id = wasm.getObjectIdAtIndex(i);
        if (wasm.objectExists(id) && !newNumericIds.includes(id)) {
          existingTotalHeight += wasm.getObjectHeight(id);
          existingCount++;
        }
      }
      const existingAvgHeight = existingCount > 0 ? existingTotalHeight / existingCount : targetHeight;
      
      // Normalize only the new items to match existing height
      normalizeItemHeights(newNumericIds, existingAvgHeight);
    }
    
    // Recalculate bounds after normalization (dimensions may have changed)
    minX = Infinity;
    minY = Infinity;
    maxX = -Infinity;
    maxY = -Infinity;
    
    newItemIds.forEach(stringId => {
      const numericId = getNumericId(stringId);
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
    
    // Select newly added items
    if (newItemIds.length > 0) {
      setSelectedIds(newItemIds);
      
      // Dispatch event for asset addition (for CloudGrid to track)
      window.dispatchEvent(new CustomEvent('assets-added', {
        detail: { assets: newAssets }
      }));
      
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
  }, [wasm, gridSize, normalizeItemHeights]);

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
    if (isPinchingRef.current) return;
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
    if (isPinchingRef.current) return;
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
      if (isPinchingRef.current) return;
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
            node.x(snapToGrid(nodeInitialPos.x + dx, gridSize));
            node.y(snapToGrid(nodeInitialPos.y + dy, gridSize));
          }
        }
      });
    },
    [selectedIds]
  );

  // Handle drag end - commit to WASM
  const handleDragEnd = useCallback(
    (draggedId: string, newX: number, newY: number) => {
      if (isPinchingRef.current) return;
      if (!wasm) return;

      // For group selections, only process the first onDragEnd event
      // (Konva fires onDragEnd for each item in the selection)
      if (selectedIds.length > 1 && !dragInitialPositionsRef.current) {
        return; // Already processed by first event
      }

      if (selectedIds.length <= 1) {
        // Single item drag
        const numericId = getNumericId(draggedId);
        const node = imageNodesRef.current.get(draggedId);
        if (node && numericId > 0) {
          node.x(snapToGrid(newX, gridSize));
          node.y(snapToGrid(newY, gridSize));
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
          const node = imageNodesRef.current.get(pos.id);
          if (node && numericId > 0) {
            node.x(snapToGrid(pos.x + snapOffset.dx, gridSize));
            node.y(snapToGrid(pos.y + snapOffset.dy, gridSize));
            return {
              objectId: numericId,
              x: snapToGrid(pos.x + snapOffset.dx, gridSize),
              y: snapToGrid(pos.y + snapOffset.dy, gridSize),
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
  const handleStagePointereDown = useCallback(
    (e: Konva.KonvaEventObject<TouchEvent | MouseEvent | PointerEvent>) => {
      if (activeTool !== 'select') return;
      if (e.target !== e.target.getStage()) return;
      if (isPinchingRef.current) return;
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
  const handleStagePointerMove = useCallback(
    (_e: Konva.KonvaEventObject<TouchEvent | MouseEvent>) => {
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

  const handleStageMouseMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      handleStagePointerMove(e);
    },
    [handleStagePointerMove]
  );
  const handleStageTouchMove = useCallback(
    (e: Konva.KonvaEventObject<TouchEvent>) => {
      handleStagePointerMove(e);
    },
    [handleStagePointerMove]
  );

  // Handle stage mouse up
  const handleStagePointerUp = useCallback(
    (e: Konva.KonvaEventObject<TouchEvent | MouseEvent | PointerEvent>) => {
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

  const handleStageMouseUp = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      handleStagePointerUp(e);
    },
    [handleStagePointerUp]
  );
  const handleStageTouchUp = useCallback(
    (e: Konva.KonvaEventObject<TouchEvent>) => {
      handleStagePointerUp(e);
    },
    [handleStagePointerUp]
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

  // Hammer.js gesture manager ref
  const hammerRef = useRef<any>(null);



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
        const oldWidth = node.width();
        const oldHeight = node.height();
        const aspectRatio = oldWidth / oldHeight;

        let newWidth = snapToGrid(oldWidth * scaleX, gridSize);
        let newHeight = snapToGrid(oldHeight * scaleY, gridSize);

        if (aspectRatio >= 1) {
          if (newWidth > maxSize) {
            newWidth = maxSize;
            newHeight = newWidth / aspectRatio;
          } else if (newWidth < minSize) {
            newHeight = minSize;
            newWidth = newHeight * aspectRatio;
          }
        } else {
          if (newHeight > maxSize) {
            newHeight = maxSize;
            newWidth = newHeight * aspectRatio;
          } else if (newHeight < minSize) {
            newWidth = minSize;
            newHeight = newWidth / aspectRatio;
          }
        }

        const newX = snapToGrid(node.x(), gridSize);
        const newY = snapToGrid(node.y(), gridSize);

        node.width(newWidth);
        node.height(newHeight);

        node.x(newX);
        node.y(newY);
      
        resizes.push({
          objectId: numericId,
          x: newX,
          y: newY,
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
        onClick={handleStageClick}
        onTap={handleStageClick}
        onWheel={handleWheel}
        onPointerDown={handleStagePointereDown}
        onPointerMove={handleStagePointerMove}
        onMouseUp={handleStageMouseUp}
        onTouchMove={handleStageTouchMove}
        onTouchEnd={handleStageTouchUp}
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
              isPinching={isPinching}
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
            rotateEnabled={false}
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
