# Canvas Operations API Documentation

This document describes the canvas operations and React component APIs in CloudGrid.

## Canvas Component

The main canvas component (`Canvas.tsx`) provides an infinite canvas with support for images, selection, and manipulation.

### Props

```typescript
interface CanvasProps {
  wasm: WASMExports | null;  // WASM module instance
  activeTool: ToolType;       // Current active tool ('select' | 'pan')
  gridSize: number;           // Grid size for snapping
  onStatsUpdate: (visible: number, total: number, fps: number) => void;
}
```

### Usage

```tsx
import { Canvas } from '@/components/Canvas';

function App() {
  const [wasm, setWasm] = useState<WASMExports | null>(null);
  const [activeTool, setActiveTool] = useState<ToolType>('select');
  const [gridSize, setGridSize] = useState(20);

  return (
    <Canvas
      wasm={wasm}
      activeTool={activeTool}
      gridSize={gridSize}
      onStatsUpdate={(visible, total, fps) => {
        console.log(`Rendering ${visible}/${total} items at ${fps} FPS`);
      }}
    />
  );
}
```

## Image Management

### CanvasImage Type

```typescript
interface CanvasImage {
  id: string;      // Unique identifier
  x: number;       // X position (world coordinates)
  y: number;       // Y position (world coordinates)
  width: number;   // Width in pixels
  height: number;  // Height in pixels
  src: string;     // Image source URL
}
```

### Adding Images Programmatically

```typescript
// Global function exposed on window
window.cloudGridAddImage = () => {
  // Adds a random image to the canvas
};

// Or modify the images state directly in your component
setImages(prev => [...prev, {
  id: `img-${Date.now()}`,
  x: snapToGrid(100, gridSize),
  y: snapToGrid(100, gridSize),
  width: snapToGrid(400, gridSize),
  height: snapToGrid(300, gridSize),
  src: 'https://picsum.photos/1920/1080',
}]);
```

## Selection System

### Single Selection

Click on an item to select it. The previously selected items are deselected.

### Multi-Selection

1. **Shift+Click**: Add or remove items from selection
2. **Rubber band**: Click and drag on empty space to select multiple items

### Selection State

```typescript
const [selectedIds, setSelectedIds] = useState<string[]>([]);

// Check if item is selected
const isSelected = selectedIds.includes(item.id);

// Select single item
setSelectedIds([itemId]);

// Toggle selection
setSelectedIds(prev => 
  prev.includes(itemId) 
    ? prev.filter(id => id !== itemId) 
    : [...prev, itemId]
);

// Clear selection
setSelectedIds([]);

// Select all
setSelectedIds(images.map(img => img.id));
```

## Pan & Zoom

### Panning

- **Scroll**: Pan the canvas
- **Pan Tool**: Click and drag to pan

```typescript
// Pan state
const [stagePos, setStagePos] = useState({ x: 0, y: 0 });

// Update pan position
setStagePos(prev => ({
  x: prev.x - deltaX,
  y: prev.y - deltaY,
}));
```

### Zooming

- **Ctrl/Cmd + Scroll**: Zoom in/out around cursor position

```typescript
// Zoom state
const [scale, setScale] = useState(1);

// Zoom limits
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 10;

// Zoom around a point
const zoomAroundPoint = (newScale: number, pointX: number, pointY: number) => {
  const clampedScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newScale));
  
  const mousePointTo = {
    x: (pointX - stagePos.x) / scale,
    y: (pointY - stagePos.y) / scale,
  };

  setScale(clampedScale);
  setStagePos({
    x: pointX - mousePointTo.x * clampedScale,
    y: pointY - mousePointTo.y * clampedScale,
  });
};
```

## Grid Snapping

### Grid Utilities

```typescript
import { snapToGrid, getGroupSnapOffset } from '@/lib/grid-utils';

// Snap a single value to grid
const snappedX = snapToGrid(123, 20); // Returns 120

// Get snap offset for a group (preserves relative positions)
const items = [
  { x: 105, y: 203 },
  { x: 205, y: 303 },
];
const offset = getGroupSnapOffset(items, 20);
// Returns { dx: -5, dy: -3 } to snap group's top-left to grid
```

### Visual Grid

The grid is rendered using a Web Worker for performance:

```typescript
// Grid worker renders dots at grid intervals
// Visual spacing adjusts based on zoom for clarity
// Actual snapping always uses fixed gridSize
```

## Drag & Drop

### Single Item Drag

```typescript
const handleDragEnd = (id: string, newX: number, newY: number) => {
  setImages(prev => prev.map(img => 
    img.id === id 
      ? { ...img, x: snapToGrid(newX, gridSize), y: snapToGrid(newY, gridSize) }
      : img
  ));
};
```

### Group Drag

When multiple items are selected, they move together while preserving relative positions:

```typescript
// 1. Record initial positions at drag start (from React state)
const handleDragStart = () => {
  const positions = new Map();
  selectedIds.forEach(id => {
    const img = images.find(i => i.id === id);
    if (img) positions.set(id, { x: img.x, y: img.y });
  });
  dragInitialPositionsRef.current = positions;
};

// 2. Sync other items during drag (direct Konva manipulation)
const handleDragMove = (draggedId: string, newX: number, newY: number) => {
  const initialPos = dragInitialPositionsRef.current.get(draggedId);
  const dx = newX - initialPos.x;
  const dy = newY - initialPos.y;

  selectedIds.forEach(id => {
    if (id !== draggedId) {
      const node = imageNodesRef.current.get(id);
      const nodeInitialPos = dragInitialPositionsRef.current.get(id);
      if (node && nodeInitialPos) {
        node.x(nodeInitialPos.x + dx);
        node.y(nodeInitialPos.y + dy);
      }
    }
  });
};

// 3. Finalize positions with group snapping
const handleDragEnd = (draggedId: string, newX: number, newY: number) => {
  const totalDx = newX - initialPos.x;
  const totalDy = newY - initialPos.y;

  // Calculate final positions for all items
  const finalPositions = selectedIds.map(id => ({
    id,
    x: initialPositions.get(id).x + totalDx,
    y: initialPositions.get(id).y + totalDy,
  }));

  // Snap group by top-left corner
  const snapOffset = getGroupSnapOffset(finalPositions, gridSize);

  // Apply same offset to all items
  setImages(prev => prev.map(img => {
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
};
```

## Resize / Transform

### Transformer Component

The Konva Transformer handles resize operations:

```tsx
<Transformer
  ref={transformerRef}
  keepRatio={true}  // Maintain aspect ratio
  enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
  boundBoxFunc={(oldBox, newBox) => {
    const minSize = gridSize * MIN_SIZE_MULTIPLIER;
    const maxSize = gridSize * MAX_SIZE_MULTIPLIER;
    
    if (newBox.width < minSize || newBox.height < minSize) return oldBox;
    if (newBox.width > maxSize || newBox.height > maxSize) return oldBox;
    return newBox;
  }}
  onTransformEnd={handleTransformEnd}
/>
```

### Size Limits

```typescript
const MIN_SIZE_MULTIPLIER = 2;   // Min = 2 × gridSize (40px default)
const MAX_SIZE_MULTIPLIER = 200; // Max = 200 × gridSize (4000px default)
```

## Viewport Culling

Only images within the viewport (plus padding) are rendered:

```typescript
const visibleImages = useMemo(() => {
  const padding = 200;
  const worldLeft = -stagePos.x / scale - padding;
  const worldTop = -stagePos.y / scale - padding;
  const worldRight = worldLeft + dimensions.width / scale + padding * 2;
  const worldBottom = worldTop + dimensions.height / scale + padding * 2;

  return images.filter(img => {
    const imgRight = img.x + img.width;
    const imgBottom = img.y + img.height;
    return !(
      imgRight < worldLeft ||
      img.x > worldRight ||
      imgBottom < worldTop ||
      img.y > worldBottom
    );
  });
}, [images, stagePos, scale, dimensions]);
```

## Level of Detail (LOD)

Images are loaded at appropriate resolutions based on display size:

```typescript
const RESOLUTION_LEVELS = [
  { name: 'tiny', maxDim: 50 },
  { name: 'thumb', maxDim: 100 },
  { name: 'small', maxDim: 200 },
  { name: 'medium', maxDim: 400 },
  { name: 'large', maxDim: 800 },
  { name: 'full', maxDim: Infinity },
];

// Select resolution based on display size
function selectResolutionLevel(displayWidth: number, displayHeight: number) {
  const maxDisplayDim = Math.max(displayWidth, displayHeight);
  for (const level of RESOLUTION_LEVELS) {
    if (level.maxDim >= maxDisplayDim * 0.75) {
      return level.name;
    }
  }
  return 'full';
}
```

## Web Workers

### Grid Worker

Renders the grid dots on an OffscreenCanvas:

```typescript
// grid.worker.ts
self.onmessage = (e) => {
  const { width, height, gridSize, stageX, stageY, scale } = e.data;
  
  // Render grid to OffscreenCanvas
  const offscreen = new OffscreenCanvas(width, height);
  const ctx = offscreen.getContext('2d');
  
  // Draw dots...
  
  // Transfer bitmap back
  const bitmap = offscreen.transferToImageBitmap();
  self.postMessage({ type: 'rendered', bitmap }, [bitmap]);
};
```

### Image Loader Worker

Generates multiple resolution levels from source images:

```typescript
// image-loader.worker.ts
self.onmessage = async (e) => {
  const { src, id } = e.data;
  
  // Fetch and decode image
  const response = await fetch(src);
  const blob = await response.blob();
  const imageBitmap = await createImageBitmap(blob);
  
  // Generate resolution levels
  const levels = {};
  for (const level of RESOLUTION_LEVELS) {
    // Scale and cache
    levels[level.name] = createScaledBitmap(imageBitmap, level.maxDim);
  }
  
  self.postMessage({ type: 'loaded', id, levels }, Object.values(levels));
};
```

## Keyboard Shortcuts

```typescript
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Delete selected items
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length > 0) {
      setImages(prev => prev.filter(img => !selectedIds.includes(img.id)));
      setSelectedIds([]);
    }
    
    // Select all
    if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
      e.preventDefault();
      setSelectedIds(images.map(img => img.id));
    }
  };

  document.addEventListener('keydown', handleKeyDown);
  return () => document.removeEventListener('keydown', handleKeyDown);
}, [selectedIds, images]);
```

## Performance Tips

1. **Use viewport culling** - Only render visible items
2. **Leverage LOD** - Load appropriate image resolutions
3. **Batch state updates** - Group related state changes
4. **Memoize expensive computations** - Use `useMemo` for filtering/calculations
5. **Use Web Workers** - Offload heavy operations
6. **Minimize re-renders** - Use `React.memo` for components

## Extending the Canvas

### Adding Custom Item Types

1. Create a new component extending the pattern of `CanvasImageNode`
2. Add the type to `CanvasImage` or create a union type
3. Update rendering logic to handle the new type

### Custom Tools

1. Add tool type to `ToolType`
2. Update `Toolbar` with new tool button
3. Handle tool-specific logic in canvas event handlers
