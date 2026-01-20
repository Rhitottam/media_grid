# 🌐 CloudGrid

**A high-performance, infinite canvas library for React with WebAssembly-powered rendering**

[![NPM Version](https://img.shields.io/npm/v/@convadraw/cloudgrid.svg)](https://www.npmjs.com/package/@convadraw/cloudgrid)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Demo](https://img.shields.io/badge/demo-live-brightgreen)](https://rhitottam.github.io/convadraw/)

> Build infinite canvas applications with 2000+ media items at 60 FPS. Powered by WebAssembly, Web Workers, and React.

![CloudGrid Demo](./docs/demo.jpeg)

## 🚀 Quick Start

```bash
npm install @convadraw/cloudgrid
```

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

[📖 **Full Documentation**](./packages/cloudgrid/README.md) • [🎮 **Live Demo**](https://rhitottam.github.io/convadraw/) • [📦 **NPM Package**](https://www.npmjs.com/package/@convadraw/cloudgrid)

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🚀 **High Performance** | WebAssembly-powered canvas operations with spatial indexing |
| 🎨 **2000+ Items** | Handle thousands of media items smoothly at 60 FPS |
| 🔄 **Undo/Redo** | Full history management with batch operations |
| 🎯 **Smart Selection** | Multi-select with rubber band, group move/resize |
| 📐 **Grid Snapping** | Configurable grid with dynamic visual feedback |
| 🔍 **Smooth Zoom** | Animated camera controls with easing functions |
| 🎭 **LOD System** | Level-of-detail rendering for optimal memory usage |
| 🧵 **Web Workers** | Non-blocking grid rendering and image processing |
| 🎨 **Color Sorting** | Sort media by dominant RGB colors |
| 📦 **TypeScript** | Full type safety and IntelliSense support |

## 📊 Performance

```
✅ 2000+ media items at 60 FPS
✅ <400MB memory usage with high-res images
✅ Smooth animations with hardware acceleration
✅ Non-blocking operations via Web Workers
✅ Instant undo/redo for all operations
```

## 🏗️ Architecture

CloudGrid is built as a monorepo with multiple packages:

```
cloudgrid/
├── packages/
│   ├── cloudgrid/       # Main React SDK
│   ├── wasm/            # WebAssembly module (AssemblyScript)
│   ├── editor/          # Core editor logic
│   ├── state/           # State management
│   └── primitives/      # Math utilities
└── apps/
    └── www/             # Demo application
```

### Technology Stack

- **React 18** - UI framework with concurrent features
- **Konva.js** - High-performance canvas rendering
- **AssemblyScript** - WebAssembly compilation for critical operations
- **Web Workers** - Background processing for grid rendering & image loading
- **Tailwind CSS v4** - Modern utility-first styling
- **TypeScript** - End-to-end type safety
- **Turborepo** - Fast, scalable monorepo build system

## 📦 Packages

### [@convadraw/cloudgrid](./packages/cloudgrid)

The main React SDK. This is what you install and use in your applications.

```bash
npm install @convadraw/cloudgrid
```

### [@cloudgrid/wasm](./packages/wasm)

WebAssembly module for high-performance canvas operations:
- Spatial indexing (Quadtree)
- Viewport culling
- Grid snapping
- Command history (undo/redo)
- Batch operations

### [@cloudgrid/editor](./packages/editor)

Framework-agnostic editor logic.

### [@cloudgrid/state](./packages/state)

Centralized state management.

### [@cloudgrid/primitives](./packages/primitives)

Math utilities (vectors, boxes, snapping).

## 🎯 Use Cases

- **Design Tools**: Build Figma-like design applications
- **Image Galleries**: Infinite scrolling image galleries
- **Mood Boards**: Create visual mood boards with 1000s of images
- **Photo Editors**: Build photo organization and editing tools
- **Data Visualization**: Visualize large datasets on infinite canvas
- **Whiteboarding**: Real-time collaborative whiteboarding apps

## 🚦 Getting Started

### 1. Installation

```bash
npm install @convadraw/cloudgrid
```

### 2. Import CSS

```tsx
import '@convadraw/cloudgrid/cloudgrid.css';
```

### 3. Use Component

```tsx
import { CloudGrid } from '@convadraw/cloudgrid';

function App() {
  return <CloudGrid />;
}
```

### 4. Add Controls

```tsx
import { CloudGrid, useCamera, selectItems, zoomToSelected } from '@convadraw/cloudgrid';

function App() {
  const camera = useCamera();

  return (
    <>
      <button onClick={() => camera.resetView()}>Reset</button>
      <CloudGrid />
    </>
  );
}
```

[See full documentation →](./packages/cloudgrid/README.md)

## 🎮 Demo

Try the live demo: [https://yourusername.github.io/cloudgrid](https://yourusername.github.io/cloudgrid)

Or run locally:

```bash
git clone https://github.com/yourusername/cloudgrid.git
cd cloudgrid
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## 🧪 Development

This is a Turborepo monorepo. To get started:

### Prerequisites

- Node.js 18+
- npm 9+

### Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/cloudgrid.git
cd cloudgrid

# Install dependencies
npm install

# Build all packages
npm run build

# Run demo app
cd apps/www
npm run dev
```

### Commands

```bash
npm run build        # Build all packages
npm run dev          # Start demo app
npm run lint         # Lint all packages
npm run test         # Run tests (when available)
npm run clean        # Clean build artifacts
```

### Package Development

To develop a specific package:

```bash
# Build WASM module
cd packages/wasm
npm run build

# Build React SDK
cd packages/cloudgrid
npm run build

# Watch mode (auto-rebuild)
npm run build -- --watch
```

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for details.

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style

- Use TypeScript for all new code
- Follow existing code style (ESLint)
- Add tests for new features
- Update documentation

## 📄 License

MIT © 2026 - see [LICENSE](./LICENSE) for details

## 🙏 Acknowledgments

- Inspired by [tldraw](https://github.com/tldraw/tldraw) - Excellent infinite canvas library
- Built with [Konva.js](https://konvajs.org/) - HTML5 2D canvas library
- Icons by [Phosphor Icons](https://phosphoricons.com/) - Beautiful icon family
- Styled with [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework

## 📞 Support

- 📖 [Documentation](./packages/cloudgrid/README.md)
- 🐛 [Issue Tracker](https://github.com/yourusername/cloudgrid/issues)
- 💬 [Discussions](https://github.com/yourusername/cloudgrid/discussions)
- 📧 [Email](mailto:support@cloudgrid.dev)

## 🗺️ Roadmap

- [ ] React Native support
- [ ] Video support
- [ ] Text editing
- [ ] Real-time collaboration
- [ ] Export to PNG/SVG
- [ ] Layers & groups
- [ ] Custom shapes
- [ ] Pen tool
- [ ] Animation timeline

## ⭐ Star History

If you find CloudGrid useful, please consider giving it a star! ⭐

---

**Made with ❤️ by the CloudGrid team**
