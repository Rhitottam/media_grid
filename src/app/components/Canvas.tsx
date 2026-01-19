import { getGroupSnapOffset, snapToGrid } from '@/lib/grid-utils';
import type { CanvasImage } from '@/types/canvas';
import type { ToolType } from '@/types/tools';
import type { WASMExports } from '@/types/wasm';
import Konva from 'konva';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image as KonvaImage, Layer, Rect, Stage, Transformer } from 'react-konva';

// Import workers
import GridWorker from '../workers/grid.worker?worker';
import ImageLoaderWorker from '../workers/image-loader.worker?worker';

interface CanvasProps {
  wasm: WASMExports | null;
  activeTool: ToolType;
  gridSize: number;
  onStatsUpdate: (visible: number, total: number, fps: number) => void;
}

// Resize limits (as multipliers of gridSize)
const MIN_SIZE_MULTIPLIER = 2;   // Minimum size = 2 * gridSize (e.g., 40px if gridSize=20)
const MAX_SIZE_MULTIPLIER = 200; // Maximum size = 200 * gridSize (e.g., 4000px if gridSize=20)

// Resolution levels matching the worker
const RESOLUTION_LEVELS = [
  { name: 'tiny', maxDim: 50 },
  { name: 'thumb', maxDim: 100 },
  { name: 'small', maxDim: 200 },
  { name: 'medium', maxDim: 400 },
  { name: 'large', maxDim: 800 },
  { name: 'full', maxDim: Infinity },
] as const;

type ResolutionLevel = typeof RESOLUTION_LEVELS[number]['name'];

interface ImageCacheEntry {
  levels: Record<ResolutionLevel, ImageBitmap>;
  originalWidth: number;
  originalHeight: number;
}

const imageCache = new Map<string, ImageCacheEntry>();
const loadingImages = new Set<string>();
let imageWorker: Worker | null = null;

function selectResolutionLevel(displayWidth: number, displayHeight: number): ResolutionLevel {
  const maxDisplayDim = Math.max(displayWidth, displayHeight);
  for (const level of RESOLUTION_LEVELS) {
    if (level.maxDim >= maxDisplayDim * 0.75) {
      return level.name;
    }
  }
  return 'full';
}

function getImageWorker(): Worker {
  if (!imageWorker) {
    imageWorker = new ImageLoaderWorker();
  }
  imageWorker.onmessage = (e) => {
    const { type, id, levels, originalWidth, originalHeight } = e.data;
    if (type === 'loaded' && levels) {
      imageCache.set(id, { levels, originalWidth, originalHeight });
      loadingImages.delete(id);
      window.dispatchEvent(new CustomEvent('image-loaded', { detail: { id } }));
    } else if (type === 'error') {
      loadingImages.delete(id);
    }
  };
  return imageWorker;
}

function useImageWithLOD(
  src: string,
  displayWidth: number,
  displayHeight: number,
  imageWidth: number,
  imageHeight: number
): { bitmap: ImageBitmap | undefined; level: ResolutionLevel | null } {
  const [, forceUpdate] = useState(0);
  
  const level = useMemo(() => {
    return selectResolutionLevel(displayWidth, displayHeight);
  }, [displayWidth, displayHeight]);

  useEffect(() => {
    if (imageCache.has(src)) return;

    if (loadingImages.has(src)) {
      const handleLoaded = (e: CustomEvent) => {
        if (e.detail.id === src) forceUpdate((n) => n + 1);
      };
      window.addEventListener('image-loaded', handleLoaded as EventListener);
      return () => window.removeEventListener('image-loaded', handleLoaded as EventListener);
    }

    loadingImages.add(src);
    const worker = getImageWorker();
    worker.postMessage({ type: 'load', id: src, src, originalWidth: imageWidth, originalHeight: imageHeight });

    const handleLoaded = (e: CustomEvent) => {
      if (e.detail.id === src) forceUpdate((n) => n + 1);
    };
    window.addEventListener('image-loaded', handleLoaded as EventListener);
    return () => window.removeEventListener('image-loaded', handleLoaded as EventListener);
  }, [src, imageWidth, imageHeight]);

  useEffect(() => {
    if (imageCache.has(src)) forceUpdate((n) => n + 1);
  }, [src, level]);

  const cached = imageCache.get(src);
  if (!cached) return { bitmap: undefined, level: null };
  return { bitmap: cached.levels[level], level };
}

// Selection rectangle for rubber band selection
interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Individual image component (simplified - transformer handled at parent level)
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
  
  const { bitmap } = useImageWithLOD(
    image.src,
    displayWidth,
    displayHeight,
    image.width,
    image.height
  );

  // Provide ref to parent for transformer
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

  const throttledParams = useMemo(() => ({
    width,
    height,
    gridSize,
    stageX: Math.round(stageX / 5) * 5,
    stageY: Math.round(stageY / 5) * 5,
    scale: Math.round(scale * 100) / 100,
  }), [width, height, gridSize, Math.round(stageX / 5), Math.round(stageY / 5), Math.round(scale * 100)]);

  useEffect(() => {
    if (!workerRef.current) {
      workerRef.current = new GridWorker();
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
    ) return;

    lastParamsRef.current = { ...throttledParams };
    if (pendingRef.current || !workerRef.current) return;

    pendingRef.current = true;
    workerRef.current.postMessage({ type: 'render', ...throttledParams });
  }, [throttledParams]);

  useEffect(() => () => { workerRef.current?.terminate(); }, []);

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

export const Canvas = memo(function Canvas({
  wasm,
  activeTool,
  gridSize,
  onStatsUpdate,
}: CanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [images, setImages] = useState<CanvasImage[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [selectionRect, setSelectionRect] = useState<SelectionRect | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const selectionStartRef = useRef<{ x: number; y: number } | null>(null);
  const lastFrameTime = useRef(0);
  const animationIdRef = useRef(0);
  const wasmInitializedRef = useRef(false);
  const imageNodesRef = useRef<Map<string, Konva.Image | null>>(new Map());

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

  // Initialize images
  useEffect(() => {
    if (!wasm || wasmInitializedRef.current) return;
    wasmInitializedRef.current = true;
    wasm.createCanvas(dimensions.width, dimensions.height, gridSize);

    const IMAGE_COUNT = 2000;
    const COLS = 50;
    // Ensure dimensions are multiples of grid size
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

    const initialImages: CanvasImage[] = [];
    for (let i = 0; i < IMAGE_COUNT; i++) {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      // Snap offsets to grid
      const offsetX = snapToGrid(-(COLS * CELL_WIDTH) / 2, gridSize);
      const offsetY = snapToGrid(-(Math.ceil(IMAGE_COUNT / COLS) * CELL_HEIGHT) / 2, gridSize);

      // Positions are grid-aligned (no jitter)
      initialImages.push({
        id: `img-${i}`,
        x: offsetX + col * CELL_WIDTH,
        y: offsetY + row * CELL_HEIGHT,
        width: IMAGE_WIDTH,
        height: IMAGE_HEIGHT,
        src: `https://picsum.photos/seed/cloudgrid${i}/${imageSizes[i % imageSizes.length].w}/${imageSizes[i % imageSizes.length].h}`,
      });
    }
    setImages(initialImages);
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

  // Add image globally
  useEffect(() => {
    (window as any).cloudGridAddImage = () => {
      const id = Date.now().toString();
      const seed = Math.floor(Math.random() * 1000);
      setImages((prev) => [...prev, {
        id,
        x: snapToGrid(Math.random() * 2000 - 1000, gridSize),
        y: snapToGrid(Math.random() * 2000 - 1000, gridSize),
        width: snapToGrid(300, gridSize),
        height: snapToGrid(200, gridSize),
        src: `https://picsum.photos/seed/${seed}/1920/1080`,
      }]);
    };
  }, [gridSize]);

  // Handle image selection
  const handleImageSelect = useCallback((id: string, shiftKey: boolean) => {
    if (shiftKey) {
      // Toggle selection with shift
      setSelectedIds((prev) => 
        prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
      );
    } else {
      // Single select
      setSelectedIds([id]);
    }
  }, []);

  // Track initial positions for group drag
  const dragInitialPositionsRef = useRef<Map<string, { x: number; y: number }> | null>(null);

  // Handle drag start - record initial positions from REACT STATE (not Konva nodes)
  // This ensures we capture positions BEFORE Konva starts modifying them
  const handleDragStart = useCallback(() => {
    const positions = new Map<string, { x: number; y: number }>();
    selectedIds.forEach((id) => {
      // Use React state as source of truth, not Konva node positions
      const img = images.find(i => i.id === id);
      if (img) {
        positions.set(id, { x: img.x, y: img.y });
      }
    });
    dragInitialPositionsRef.current = positions;
  }, [selectedIds, images]);

  // Handle drag move - sync other selected items
  const handleDragMove = useCallback((draggedId: string, newX: number, newY: number) => {
    if (!dragInitialPositionsRef.current || selectedIds.length <= 1) return;
    if (!selectedIds.includes(draggedId)) return;

    const initialPos = dragInitialPositionsRef.current.get(draggedId);
    if (!initialPos) return;

    const dx = newX - initialPos.x;
    const dy = newY - initialPos.y;

    // Directly update other selected Konva nodes (no React state)
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
  }, [selectedIds]);

  // Handle drag end - finalize all selected items' positions
  const handleDragEnd = useCallback((draggedId: string, newX: number, newY: number) => {
    if (selectedIds.length <= 1 || !dragInitialPositionsRef.current) {
      // Single item drag - snap position to grid
      setImages((prev) => prev.map((img) => {
        if (img.id === draggedId) {
          return {
            ...img,
            x: snapToGrid(newX, gridSize),
            y: snapToGrid(newY, gridSize),
          };
        }
        return img;
      }));
      dragInitialPositionsRef.current = null;
      return;
    }

    // Group drag - calculate final positions using:
    // 1. The dragged item's FINAL position (newX, newY)
    // 2. Each item's ORIGINAL relative offset from the dragged item
    
    const draggedInitialPos = dragInitialPositionsRef.current.get(draggedId);
    if (!draggedInitialPos) {
      dragInitialPositionsRef.current = null;
      return;
    }

    // Calculate how much the dragged item moved
    const totalDx = newX - draggedInitialPos.x;
    const totalDy = newY - draggedInitialPos.y;

    // Calculate final positions for all items based on initial positions + total movement
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

    // Get the snap offset for the group (based on top-left corner)
    const snapOffset = getGroupSnapOffset(finalPositions, gridSize);

    // Update all selected items with the same snap offset (preserving relative positions)
    setImages((prev) => prev.map((img) => {
      const finalPos = finalPositions.find(p => p.id === img.id);
      if (finalPos) {
        return {
          ...img,
          x: finalPos.x + snapOffset.dx,
          y: finalPos.y + snapOffset.dy,
        };
      }
      return img;
    }));

    dragInitialPositionsRef.current = null;
  }, [selectedIds, gridSize]);

  // Handle stage mouse down - start rubber band selection
  const handleStageMouseDown = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (activeTool !== 'select') return;
    if (e.target !== e.target.getStage()) return;
    
    const stage = stageRef.current;
    if (!stage) return;
    
    const pos = stage.getPointerPosition();
    if (!pos) return;
    
    // Convert to world coordinates
    const worldX = (pos.x - stagePos.x) / scale;
    const worldY = (pos.y - stagePos.y) / scale;
    
    selectionStartRef.current = { x: worldX, y: worldY };
    setIsSelecting(true);
    setSelectionRect({ x: worldX, y: worldY, width: 0, height: 0 });
    
    // Clear selection if not holding shift
    if (!e.evt.shiftKey) {
      setSelectedIds([]);
    }
  }, [activeTool, stagePos, scale]);

  // Handle stage mouse move - update rubber band
  const handleStageMouseMove = useCallback((_e: Konva.KonvaEventObject<MouseEvent>) => {
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
  }, [isSelecting, stagePos, scale]);

  // Handle stage mouse up - finalize rubber band selection
  const handleStageMouseUp = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!isSelecting || !selectionRect) {
      setIsSelecting(false);
      setSelectionRect(null);
      return;
    }
    
    // Find images that intersect with selection rectangle
    const newSelectedIds: string[] = e.evt.shiftKey ? [...selectedIds] : [];
    
    images.forEach((img) => {
      const imgRight = img.x + img.width;
      const imgBottom = img.y + img.height;
      const rectRight = selectionRect.x + selectionRect.width;
      const rectBottom = selectionRect.y + selectionRect.height;
      
      // Check intersection
      if (!(imgRight < selectionRect.x || img.x > rectRight || 
            imgBottom < selectionRect.y || img.y > rectBottom)) {
        if (!newSelectedIds.includes(img.id)) {
          newSelectedIds.push(img.id);
        }
      }
    });
    
    setSelectedIds(newSelectedIds);
    setIsSelecting(false);
    setSelectionRect(null);
    selectionStartRef.current = null;
  }, [isSelecting, selectionRect, images, selectedIds]);

  // Handle stage click - deselect if clicking empty area
  const handleStageClick = useCallback((e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (e.target === e.target.getStage() && !isSelecting && selectedIds.length > 0) {
      // Only deselect if we weren't rubber band selecting
      if (!selectionRect) {
        setSelectedIds([]);
      }
    }
  }, [isSelecting, selectionRect, selectedIds]);

  // Handle wheel
  const handleWheel = useCallback((e: Konva.KonvaEventObject<WheelEvent>) => {
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
      setStagePos((prev) => ({
        x: prev.x - e.evt.deltaX,
        y: prev.y - e.evt.deltaY,
      }));
    }
  }, [scale, stagePos]);

  // Handle stage drag
  const handleStageDragEnd = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    if (e.target === e.target.getStage()) {
      setStagePos({ x: e.target.x(), y: e.target.y() });
    }
  }, []);

  // Handle transform end
  const handleTransformEnd = useCallback((_e: Konva.KonvaEventObject<Event>) => {
    // Update all transformed images
    const transformer = transformerRef.current;
    if (!transformer) return;

    const minSize = gridSize * MIN_SIZE_MULTIPLIER;
    const maxSize = gridSize * MAX_SIZE_MULTIPLIER;

    const nodes = transformer.nodes();
    const updates: { id: string; x: number; y: number; width: number; height: number }[] = [];

    nodes.forEach((node) => {
      const id = node.id();
      const scaleX = node.scaleX();
      const scaleY = node.scaleY();
      
      node.scaleX(1);
      node.scaleY(1);

      // Calculate new dimensions with grid snapping
      let newWidth = snapToGrid(node.width() * scaleX, gridSize);
      let newHeight = snapToGrid(node.height() * scaleY, gridSize);

      // Clamp to min/max size limits
      newWidth = Math.max(minSize, Math.min(maxSize, newWidth));
      newHeight = Math.max(minSize, Math.min(maxSize, newHeight));

      updates.push({
        id,
        x: snapToGrid(node.x(), gridSize),
        y: snapToGrid(node.y(), gridSize),
        width: newWidth,
        height: newHeight,
      });
    });

    setImages((prev) => prev.map((img) => {
      const update = updates.find((u) => u.id === img.id);
      return update ? { ...img, ...update } : img;
    }));
  }, [gridSize]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length > 0) {
        setImages((prev) => prev.filter((img) => !selectedIds.includes(img.id)));
        setSelectedIds([]);
      }
      // Select all with Ctrl/Cmd + A
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        setSelectedIds(images.map((img) => img.id));
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds, images]);

  const cursorStyle = activeTool === 'pan' ? 'grab' : isSelecting ? 'crosshair' : 'default';

  return (
    <div
      ref={containerRef}
      className="flex-1 relative overflow-hidden"
      style={{ cursor: cursorStyle }}
    >
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
        onMouseDown={handleStageMouseDown}
        onMouseMove={handleStageMouseMove}
        onMouseUp={handleStageMouseUp}
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

          {/* Transformer for selected items - handles resize */}
          <Transformer
            ref={transformerRef}
            flipEnabled={false}
            boundBoxFunc={(oldBox, newBox) => {
              const minSize = gridSize * MIN_SIZE_MULTIPLIER;
              const maxSize = gridSize * MAX_SIZE_MULTIPLIER;
              
              // Enforce min/max size limits
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
    </div>
  );
});
