# Changelog

All notable changes to CloudGrid will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.8] - 2026-01-23

### 🐛 Bug Fixes

#### WASM Batch Operations Not Applying Changes
- **Fixed Critical Bug**: Batch move and resize operations were not applying changes to WASM state
- **Root Cause**: Signature mismatch between TypeScript interface and WASM implementation
  - TypeScript expected: `addToBatchMove(objectId, oldX, oldY, newX, newY)`
  - WASM implemented: `addToBatchMove(objectId, newX, newY)` - was reading old values from object
- **Impact**: Multiple batch operations would always use stale "old" positions/dimensions
- **Solution**: Updated WASM functions to accept and use provided old values
  - `addToBatchMove` now accepts all 5 parameters
  - `addToBatchResize` now accepts all 9 parameters
- **Result**: Batch operations now correctly apply changes AND maintain proper undo/redo history

## [1.0.7] - 2026-01-23

### 🎨 Major UI/UX Improvements

#### Masonry Grid Layout for Color Sorting
- **Variable Width Layout**: Images now have fixed height but variable width based on aspect ratio
- **Better Space Utilization**: No wasted space, natural organic layout
- **Fixed Gaps**: Consistent spacing between all images
- **Centered Rows**: Each row centered horizontally for visual balance
- **Group Sorting Support**: Sort selected images or all images
- **Contextual Positioning**: Group sorts appear below existing content, all-images sorts are centered

### 🔄 Refactored

#### Asset Metadata System (Breaking Change for Internal APIs)
- **Indexed by Asset ID**: Metadata now properly indexed by asset ID instead of src URL
- **Multiple Registries**: Added registries for bidirectional ID lookups
  - `assetMetadataRegistry`: assetId → metadata
  - `numericToStringIdRegistry`: numericId → assetStringId
  - `srcToAssetIdsRegistry`: src → Set<assetId>
- **New Functions**: `getAssetStringId()` for ID conversion
- **Updated Functions**: `registerAsset()` now accepts asset string ID, `setAssetMetadata()` uses asset ID as key
- **Improved Architecture**: Clear separation between numeric WASM IDs and string asset IDs

### 📚 Documentation
- Added comprehensive `MASONRY_LAYOUT_REFACTOR.md` documentation
- Includes visual diagrams, usage examples, and migration guide

## [1.0.6] - 2026-01-23

### 🔄 Refactored

#### Asset Metadata System
- **Centralized Metadata Storage**: Removed global `imageColors` Map, replaced with unified asset metadata registry
- **Color Data Management**: Color information now stored in asset metadata alongside other intrinsic properties
- **Improved Architecture**: All asset data (colors, dimensions, file info) stored in one place for better maintainability
- **Better API**: New `getAssetMetadata()`, `setAssetMetadata()`, and `updateAssetColor()` functions exported from the library

### ✨ Enhanced

#### Color Sorting
- **Group Selection Support**: Color sort now works on selected images (group select + sort) or all images
- **Dynamic Column Count**: Automatically adjusts grid columns based on number of images being sorted
- **Better Feedback**: Improved warning messages when color data is not available
- **Metadata-Driven**: Sorts using pre-computed color scores from asset metadata

### 📚 Documentation
- Added comprehensive `ASSET_METADATA.md` documentation
- Includes API reference, usage examples, and best practices
- Explains color sorting system and metadata structure

## [1.0.0] - 2026-01-20

### 🎉 Initial Release

The first production-ready release of CloudGrid!

### ✨ Features

#### Core Canvas
- **Infinite Canvas**: Pan and zoom across unlimited space
- **WebAssembly Engine**: High-performance spatial indexing and viewport culling
- **2000+ Media Items**: Handle thousands of images smoothly at 60 FPS
- **Viewport Culling**: Only render visible items for optimal performance

#### Selection & Manipulation
- **Multi-Select**: Select multiple items with rubber band selection
- **Shift+Click**: Toggle individual items in selection
- **Group Operations**: Move and resize multiple items together
- **Grid Snapping**: Configurable grid with visual feedback
- **Size Constraints**: Min/max size limits for media items

#### Camera Controls
- **Smooth Zoom**: Animated zoom with easing functions
- **Pan Canvas**: Click and drag or use scroll wheel
- **Zoom to Fit**: Automatically frame selected items
- **Keyboard Shortcuts**: Cmd/Ctrl+Z for undo, scroll to pan/zoom
- **Programmatic API**: Control camera via hooks and helper functions

#### Undo/Redo
- **Full History**: All operations are tracked
- **Batch Operations**: Group actions create single undo entry
- **Keyboard Support**: Standard Cmd/Ctrl+Z shortcuts

#### Performance Optimizations
- **Web Workers**: Grid rendering and image processing off main thread
- **LOD System**: 3 resolution levels (small, medium, full)
- **Blob Caching**: Compressed images cached, decoded on-demand
- **Memory Efficient**: <400MB for 2000 high-res images
- **Throttled Updates**: Debounced WASM sync for smooth animations

#### Media Management
- **File Upload**: Add PNG/JPEG images via file picker
- **Auto-Arrange**: New images positioned intelligently
- **Auto-Select & Zoom**: Camera animates to new uploads
- **Delete Selected**: Remove items with keyboard or button
- **Color Sorting**: Sort by dominant RGB colors (diagonal gradient)

#### UI Components
- **Compact Toolbar**: Minimal tool selection (Select, Pan)
- **Stats Panel**: Undo/redo, zoom controls, object count
- **Configurable Positioning**: Place toolbars anywhere on screen
- **Tailwind CSS**: Modern, customizable styling with dark theme
- **Phosphor Icons**: Beautiful icon set

#### TypeScript Support
- **Full Type Safety**: End-to-end TypeScript
- **IntelliSense**: Autocomplete for all APIs
- **Type Definitions**: Comprehensive .d.ts files

#### Developer Experience
- **React Hooks**: `useCamera()` for camera controls
- **Helper Functions**: `selectItems()`, `zoomToSelected()`, etc.
- **Custom Events**: Event-based communication
- **Monorepo Structure**: Organized packages for scalability
- **Comprehensive Docs**: README, API reference, examples

### 🏗️ Architecture

- **Monorepo**: Turborepo-based with multiple packages
- **Packages**: `cloudgrid`, `wasm`, `editor`, `state`, `primitives`
- **Build System**: tsup for fast bundling, Vite for demo app
- **CSS**: Tailwind CSS v4 with PostCSS

### 📦 Packages

- `@convadraw/cloudgrid@1.0.0` - Main React SDK
- `@cloudgrid/wasm@1.0.0` - WebAssembly module
- `@cloudgrid/editor@1.0.0` - Core editor logic
- `@cloudgrid/state@1.0.0` - State management
- `@cloudgrid/primitives@1.0.0` - Math utilities

### 🎨 Styling

- Custom dark theme with `oklch` color space
- CSS variables for easy customization
- Shadcn-inspired components

### 📚 Documentation

- Comprehensive README
- API reference
- Usage examples
- Camera controls guide
- Architecture overview

### 🐛 Known Issues

None at this time. Please report issues at https://github.com/yourusername/cloudgrid/issues

### 🙏 Acknowledgments

- Inspired by [tldraw](https://github.com/tldraw/tldraw)
- Built with [Konva.js](https://konvajs.org/)
- Icons by [Phosphor Icons](https://phosphoricons.com/)
- Styled with [Tailwind CSS](https://tailwindcss.com/)

---

## [Unreleased]

### Planned Features

- React Native support
- Video support
- Text editing
- Real-time collaboration
- Export to PNG/SVG
- Layers & groups
- Custom shapes
- Pen tool
- Animation timeline

---

[1.0.0]: https://github.com/yourusername/cloudgrid/releases/tag/v1.0.0
