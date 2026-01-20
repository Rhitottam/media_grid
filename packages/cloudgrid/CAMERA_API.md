# CloudGrid Camera API

## Overview

CloudGrid provides a comprehensive camera control API for programmatically manipulating the viewport and selection state.

## Camera Methods

### Via `useCamera()` Hook

```tsx
import { useCamera } from '@convadraw/cloudgrid';

function MyComponent() {
  const camera = useCamera();
  
  // Basic controls
  camera.zoom(1.5, centerX, centerY);      // Zoom by factor
  camera.zoomTo(2.0, centerX, centerY);    // Zoom to specific scale
  camera.pan(100, -50);                     // Pan by delta
  camera.resetView();                       // Reset to default
  
  // Animated controls
  camera.animateToPosition(x, y, scale, duration);
  camera.zoomToFit(bounds, padding, duration);
  
  return <div>...</div>;
}
```

### Via Helper Functions

```tsx
import { 
  selectItems, 
  zoomToSelected, 
  zoomToBounds,
  addMedia,
  deleteSelected,
  sortByColor 
} from '@convadraw/cloudgrid';

// Programmatically select items
selectItems(['img-1', 'img-2', 'img-3']);

// Zoom to currently selected items
zoomToSelected();

// Zoom to specific bounds
zoomToBounds({ x: 0, y: 0, width: 1000, height: 800 }, 100, 500);

// Trigger file upload dialog
addMedia();

// Delete selected items
deleteSelected();

// Sort all items by color
sortByColor();
```

## Use Cases

### 1. Add Media and Auto-Zoom

When uploading new images, the camera automatically:
- Selects the newly added items
- Animates to fit them in view
- Uses smooth easing animation

```tsx
// Built-in behavior - just click the Add button!
// Or programmatically:
addMedia(); // Opens file picker
// After upload, auto-selects and zooms
```

### 2. Focus on Specific Items

```tsx
function focusOnImages(ids: string[]) {
  selectItems(ids);
  zoomToSelected();
}

// Example usage
focusOnImages(['img-1', 'img-2', 'img-3']);
```

### 3. Custom Navigation

```tsx
function navigateToRegion() {
  const camera = useCamera();
  
  // Smoothly animate to a specific region
  camera.zoomToFit({
    x: 1000,
    y: 2000,
    width: 800,
    height: 600
  }, 150, 800); // 150px padding, 800ms duration
}
```

### 4. Keyboard Shortcuts

```tsx
function MyApp() {
  const camera = useCamera();
  
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'f') zoomToSelected();
      if (e.key === 'r') camera.resetView();
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [camera]);
  
  return <CloudGrid />;
}
```

## Animation Details

- **Default Duration**: 500ms
- **Easing**: Ease-in-out (smooth start and end)
- **Default Padding**: 100px around bounds
- **Max Zoom**: 10x (configurable)

## Camera State

```tsx
const camera = useCamera();

console.log(camera.scale);      // Current zoom level (1 = 100%)
console.log(camera.stagePos);   // Current camera position {x, y}

// Set directly (no animation)
camera.setScale(2.0);
camera.setStagePos({ x: 100, y: 200 });
```

## TypeScript Types

```typescript
interface CameraControls {
  // Current state
  scale: number;
  stagePos: { x: number; y: number };
  
  // Setters
  setScale: (scale: number) => void;
  setStagePos: (pos: { x: number; y: number }) => void;
  
  // Basic actions
  zoom: (factor: number, centerX?: number, centerY?: number) => void;
  zoomTo: (newScale: number, centerX?: number, centerY?: number) => void;
  pan: (dx: number, dy: number) => void;
  resetView: () => void;
  
  // Animated actions
  animateToPosition: (x: number, y: number, targetScale?: number, duration?: number) => void;
  zoomToFit: (bounds: { x: number; y: number; width: number; height: number }, padding?: number, duration?: number) => void;
}
```

## Events

The library uses custom events for communication:

- `select-items` - Programmatic selection
- `zoom-to-selected` - Zoom to selected items
- `zoom-to-bounds` - Zoom to specific bounds
- `add-media` - Trigger file upload
- `delete-selected` - Delete selected items
- `sort-by-color` - Sort items by color

You can dispatch these manually if needed:

```tsx
window.dispatchEvent(new CustomEvent('zoom-to-selected'));
```
