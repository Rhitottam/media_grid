# CloudGrid

[![Deploy to GitHub Pages](https://github.com/YOUR_USERNAME/cloud_grid/actions/workflows/deploy.yml/badge.svg)](https://github.com/YOUR_USERNAME/cloud_grid/actions/workflows/deploy.yml)

A high-performance infinite canvas built with **React**, **Konva.js**, and **WebAssembly (AssemblyScript)**. CloudGrid is designed to handle thousands of media items with smooth pan, zoom, selection, and manipulation capabilities.

![CloudGrid Demo](./docs/demo.gif)

## ✨ Features

- 🚀 **High Performance** - WebAssembly-powered spatial indexing with Quadtree
- 🖼️ **2000+ Images** - Efficiently renders thousands of high-resolution images
- 🔍 **Infinite Canvas** - Smooth pan and zoom with viewport culling
- 🎯 **Multi-Select** - Rubber band selection and shift-click for group operations
- 📐 **Grid Snapping** - Configurable grid with snap-to-grid positioning
- 🎨 **Level of Detail** - Dynamic image resolution based on zoom level
- ⚡ **Web Workers** - Offloaded grid rendering and image processing
- 📱 **Responsive** - Works on desktop and tablet devices

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm 9+

### Installation

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/cloud_grid.git
cd cloud_grid

# Install dependencies
npm install
cd src/wasm && npm install && cd ../..

# Build WASM module and start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

## 🏗️ Architecture

```
cloud_grid/
├── src/
│   ├── app/                    # React application
│   │   ├── components/         # React components
│   │   │   ├── Canvas.tsx      # Main canvas component (Konva)
│   │   │   ├── Toolbar.tsx     # Tools and controls
│   │   │   ├── Stats.tsx       # Performance stats
│   │   │   └── ui/             # shadcn/ui components
│   │   ├── core/               # Core canvas logic
│   │   │   ├── InfiniteCanvas.ts
│   │   │   ├── Renderer.ts
│   │   │   ├── InputHandler.ts
│   │   │   └── AssetManager.ts
│   │   ├── workers/            # Web Workers
│   │   │   ├── grid.worker.ts  # Grid rendering worker
│   │   │   └── image-loader.worker.ts  # Image LOD worker
│   │   ├── lib/                # Utilities
│   │   ├── types/              # TypeScript types
│   │   └── main.tsx            # Entry point
│   ├── wasm/                   # WebAssembly module
│   │   ├── assembly/           # AssemblyScript source
│   │   │   ├── index.ts        # WASM exports
│   │   │   ├── quadtree.ts     # Spatial indexing
│   │   │   ├── viewport.ts     # Camera & viewport
│   │   │   ├── canvas-manager.ts
│   │   │   ├── commands.ts     # Undo/redo system
│   │   │   └── grid.ts         # Grid system
│   │   └── build/              # Compiled WASM
│   └── styles/                 # CSS styles
├── docs/                       # Documentation
└── public/                     # Static assets
```

## 📚 Documentation

### Canvas Operations

See [docs/CANVAS_API.md](./docs/CANVAS_API.md) for detailed canvas API documentation.

### WebAssembly Module

See [docs/WASM_API.md](./docs/WASM_API.md) for WASM module documentation.

## 🎮 Controls

| Action | Control |
|--------|---------|
| Pan | Scroll or drag with Pan tool |
| Zoom | Ctrl/Cmd + Scroll |
| Select | Click item or drag to multi-select |
| Multi-select | Shift + Click to add/remove |
| Move | Drag selected items |
| Resize | Drag corner handles (keeps aspect ratio) |
| Delete | Delete or Backspace key |
| Select All | Ctrl/Cmd + A |

## 🔧 Configuration

### Grid Size

Adjust grid size via the toolbar slider (default: 20px).

### Resize Limits

Configure in `Canvas.tsx`:

```typescript
const MIN_SIZE_MULTIPLIER = 2;   // Min = 2 × gridSize
const MAX_SIZE_MULTIPLIER = 200; // Max = 200 × gridSize
```

## 🚀 Deployment

### GitHub Pages

1. Update `vite.config.ts` with your repository name:
   ```typescript
   base: '/cloud_grid/',
   ```

2. Push to GitHub and enable GitHub Pages in repository settings.

3. The GitHub Action will automatically build and deploy.

### Manual Deployment

```bash
npm run build
# Deploy the `dist/` folder to your hosting provider
```

## 🧪 Development

### Building WASM Module

```bash
cd src/wasm
npm run asbuild        # Build both debug and release
npm run asbuild:debug  # Debug build with source maps
npm run asbuild:release # Optimized release build
```

### Project Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run build:wasm` | Build WASM module only |
| `npm run preview` | Preview production build |

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS
- **Canvas**: Konva.js, react-konva
- **WebAssembly**: AssemblyScript
- **Build**: Vite
- **Components**: shadcn/ui, Radix UI

## 📦 Library Usage (Coming Soon)

CloudGrid will be available as an npm package:

```bash
npm install @cloudgrid/core @cloudgrid/react
```

```tsx
import { CloudGridCanvas } from '@cloudgrid/react';

function App() {
  return (
    <CloudGridCanvas
      gridSize={20}
      onItemSelect={(items) => console.log(items)}
    />
  );
}
```

## 🤝 Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for contribution guidelines.

## 📄 License

MIT License - see [LICENSE](./LICENSE) for details.

## 🙏 Acknowledgments

- [Konva.js](https://konvajs.org/) - 2D canvas library
- [AssemblyScript](https://www.assemblyscript.org/) - TypeScript to WebAssembly
- [shadcn/ui](https://ui.shadcn.com/) - UI components
- [tldraw](https://tldraw.com/) - Inspiration for canvas architecture
