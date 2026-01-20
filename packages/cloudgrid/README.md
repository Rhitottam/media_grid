# 🌐 CloudGrid

**A high-performance, infinite canvas library for React with WebAssembly-powered rendering**

CloudGrid is a production-ready React library for building infinite canvas applications with support for images, videos, and text. Built with performance in mind, it uses WebAssembly (AssemblyScript) for critical operations and Web Workers for non-blocking rendering.

[![NPM Version](https://img.shields.io/npm/v/@convadraw/cloudgrid.svg)](https://www.npmjs.com/package/@convadraw/cloudgrid)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/yourusername/cloudgrid/blob/main/LICENSE)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/@convadraw/cloudgrid)](https://bundlephobia.com/package/@convadraw/cloudgrid)

## ✨ Features

- 🚀 **High Performance**: WebAssembly-powered canvas operations
- 🎨 **2000+ Items**: Handle thousands of media items smoothly
- 🔄 **Undo/Redo**: Full history management with batch operations
- 🎯 **Smart Selection**: Single and multi-select with rubber band selection
- 📐 **Grid Snapping**: Configurable grid with dynamic visual feedback
- 🔍 **Smooth Zoom**: Animated camera controls with easing
- 🎭 **LOD System**: Level-of-detail rendering for optimal memory usage
- 🧵 **Web Workers**: Non-blocking grid rendering and image loading
- 🎨 **Color Sorting**: Sort media by dominant RGB colors
- 📦 **TypeScript**: Full type safety and IntelliSense support
- 🎨 **Customizable UI**: Optional toolbar with Tailwind CSS styling
- ♿ **Accessible**: Keyboard shortcuts for common operations

## 📦 Installation

```bash
npm install @convadraw/cloudgrid
```

**Peer Dependencies:**
```bash
npm install react react-dom
```

## 🚀 Quick Start

### Basic Usage

```tsx
import { CloudGrid } from '@convadraw/cloudgrid';
import '@convadraw/cloudgrid/cloudgrid.css';

function App() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <CloudGrid />
    </div>
  );
}
```

### With Camera Controls

```tsx
import { CloudGrid, useCamera, selectItems, zoomToSelected } from '@convadraw/cloudgrid';
import '@convadraw/cloudgrid/cloudgrid.css';

function App() {
  const camera = useCamera();

  const handleFocusCenter = () => {
    camera.animateToPosition(0, 0, 1, 500);
  };

  const handleZoomIn = () => {
    camera.zoom(1.2);
  };

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <button onClick={handleFocusCenter}>Center View</button>
      <button onClick={handleZoomIn}>Zoom In</button>
      <CloudGrid />
    </div>
  );
}
```

### Custom Toolbar Positioning

```tsx
import { CloudGrid } from '@convadraw/cloudgrid';
import '@convadraw/cloudgrid/cloudgrid.css';

function App() {
  return (
    <CloudGrid
      toolbarPosition="top-left"
      statsPanelPosition="top-right"
    />
  );
}
```

## 🎯 Core Concepts

### Camera System

CloudGrid uses a centralized camera system for viewport management:

```tsx
import { useCamera } from '@convadraw/cloudgrid';

function MyComponent() {
  const camera = useCamera();

  // Current state
  console.log(camera.scale);      // Current zoom level (1 = 100%)
  console.log(camera.stagePos);   // Camera position {x, y}

  // Basic controls
  camera.zoom(1.5);                // Zoom by factor
  camera.zoomTo(2.0);              // Zoom to specific scale
  camera.pan(100, -50);            // Pan by delta
  camera.resetView();              // Reset to origin

  // Animated controls
  camera.animateToPosition(x, y, scale, duration);
  camera.zoomToFit(bounds, padding, duration);
}
```

### Selection & Manipulation

```tsx
import { selectItems, zoomToSelected } from '@convadraw/cloudgrid';

// Programmatically select items
selectItems(['img-1', 'img-2', 'img-3']);

// Zoom to selected items
zoomToSelected();

// Delete selected items
deleteSelected();
```

### Media Management

```tsx
import { addMedia, sortByColor } from '@convadraw/cloudgrid';

// Trigger file upload
addMedia();

// Sort by dominant colors (RGB gradient)
sortByColor();
```

## 📚 API Reference

### Components

#### `<CloudGrid />`

Main canvas component.

**Props:**
- `toolbarPosition?: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'`
  - Position of the tools toolbar (default: `'top-left'`)
- `statsPanelPosition?: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'`
  - Position of the stats/controls panel (default: `'top-right'`)

**Example:**
```tsx
<CloudGrid
  toolbarPosition="bottom-left"
  statsPanelPosition="top-right"
/>
```

### Hooks

#### `useCamera()`

Access camera controls and state.

**Returns:**
```typescript
interface CameraControls {
  scale: number;
  stagePos: { x: number; y: number };
  setScale: (scale: number) => void;
  setStagePos: (pos: { x: number; y: number }) => void;
  zoom: (factor: number, centerX?: number, centerY?: number) => void;
  zoomTo: (newScale: number, centerX?: number, centerY?: number) => void;
  pan: (dx: number, dy: number) => void;
  resetView: () => void;
  animateToPosition: (x: number, y: number, targetScale?: number, duration?: number) => void;
  zoomToFit: (bounds: { x: number; y: number; width: number; height: number }, padding?: number, duration?: number) => void;
}
```

### Helper Functions

#### `selectItems(ids: string[])`
Programmatically select items by their IDs.

#### `zoomToSelected()`
Animate camera to fit currently selected items in view.

#### `zoomToBounds(bounds, padding?, duration?)`
Animate camera to specific bounds.

#### `addMedia()`
Trigger the file upload dialog.

#### `deleteSelected()`
Delete currently selected items.

#### `sortByColor()`
Sort all items by dominant RGB colors (creates diagonal gradient).

## 🎨 Styling

CloudGrid uses Tailwind CSS with a custom dark theme. The default theme uses `oklch` color space for consistent, vibrant colors.

### Custom Theme

You can override the default theme by adding CSS variables:

```css
:root {
  --background: oklch(0.09 0.01 255);
  --foreground: oklch(0.80 0.19 145);
  --primary: oklch(0.40 0.19 145);
  /* ... more variables */
}
```

See `cloudgrid.css` for all available CSS variables.

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + Z` | Undo |
| `Cmd/Ctrl + Shift + Z` | Redo |
| `Scroll` | Pan canvas |
| `Cmd/Ctrl + Scroll` | Zoom in/out |
| `Drag` (Select Tool) | Rubber band selection |
| `Shift + Click` | Toggle selection |
| `Delete` / `Backspace` | Delete selected |

## 🏗️ Architecture

### Performance Optimizations

1. **WebAssembly**: Critical operations (spatial indexing, viewport culling) run in WASM
2. **Web Workers**: Grid rendering and image processing off main thread
3. **LOD System**: Dynamic image resolution based on zoom level
4. **Viewport Culling**: Only visible items are rendered
5. **Blob Caching**: Compressed images cached in worker, decoded on-demand
6. **Batch Operations**: Group actions create single undo/redo entries

### Technology Stack

- **React 18** - UI framework
- **Konva.js** - Canvas rendering
- **AssemblyScript** - WebAssembly compilation
- **Web Workers** - Background processing
- **Tailwind CSS** - Styling
- **TypeScript** - Type safety

## 📊 Performance

- ✅ **2000+ media items** at 60 FPS
- ✅ **<400MB memory** usage with 2000 high-res images
- ✅ **Smooth animations** with hardware acceleration
- ✅ **Non-blocking operations** via Web Workers
- ✅ **Instant undo/redo** for all operations

## 🤝 Examples

### Example 1: Focus on Uploaded Images

```tsx
import { CloudGrid, useCamera } from '@convadraw/cloudgrid';
import { useEffect } from 'react';

function App() {
  useEffect(() => {
    // Listen for custom events
    window.addEventListener('items-added', (e) => {
      const event = e as CustomEvent;
      selectItems(event.detail.ids);
      zoomToSelected();
    });
  }, []);

  return <CloudGrid />;
}
```

### Example 2: Keyboard Navigation

```tsx
import { CloudGrid, useCamera } from '@convadraw/cloudgrid';
import { useEffect } from 'react';

function App() {
  const camera = useCamera();

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'f') zoomToSelected();
      if (e.key === 'r') camera.resetView();
      if (e.key === 'Home') camera.animateToPosition(0, 0, 1);
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [camera]);

  return <CloudGrid />;
}
```

### Example 3: Custom Controls

```tsx
import { CloudGrid, useCamera, addMedia, sortByColor } from '@convadraw/cloudgrid';

function App() {
  const camera = useCamera();

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 1000 }}>
        <button onClick={() => addMedia()}>Upload Images</button>
        <button onClick={() => sortByColor()}>Sort by Color</button>
        <button onClick={() => camera.resetView()}>Reset View</button>
        <span>Zoom: {Math.round(camera.scale * 100)}%</span>
      </div>
      <CloudGrid />
    </div>
  );
}
```

## 🔧 Advanced Usage

### Custom Media Items

CloudGrid automatically handles uploaded images. For advanced use cases, you can dispatch custom events:

```tsx
window.dispatchEvent(new CustomEvent('add-item', {
  detail: {
    type: 'image',
    src: 'https://example.com/image.jpg',
    x: 0,
    y: 0,
    width: 400,
    height: 300,
  }
}));
```

## 🐛 Troubleshooting

### Images not loading
- Ensure CORS is enabled for external images
- Check browser console for network errors
- Verify image URLs are accessible

### Performance issues
- Reduce number of items (recommended: <2000)
- Use lower resolution images
- Check if hardware acceleration is enabled in browser

### Type errors
- Ensure `@types/react` and `@types/react-dom` are installed
- Check TypeScript version compatibility (>=4.7)

## 📄 License

MIT © 2026

## 🙏 Acknowledgments

- Inspired by [tldraw](https://github.com/tldraw/tldraw)
- Built with [Konva.js](https://konvajs.org/)
- Icons by [Phosphor Icons](https://phosphoricons.com/)
- Styled with [Tailwind CSS](https://tailwindcss.com/)

## 🔗 Links

- [Documentation](https://github.com/yourusername/cloudgrid#readme)
- [Demo](https://yourusername.github.io/cloudgrid)
- [Issues](https://github.com/yourusername/cloudgrid/issues)
- [Changelog](https://github.com/yourusername/cloudgrid/blob/main/CHANGELOG.md)

---

**Made with ❤️ by the CloudGrid team**
