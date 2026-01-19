# CloudGrid - Infinite Canvas with WASM

## Project Overview
CloudGrid is a high-performance infinite canvas application similar to Figma, using WebAssembly (AssemblyScript) for viewport culling, spatial indexing, and canvas operations. The project uses TypeScript for the frontend and AssemblyScript for performance-critical WASM modules.

## Tech Stack
- **Frontend**: TypeScript, HTML5 Canvas
- **WASM Module**: AssemblyScript
- **Build Tools**: Vite (for frontend), AssemblyScript compiler
- **Testing**: Vitest (optional)

## Project Structure
```
cloudgrid/
├── src/
│   ├── wasm/                    # AssemblyScript WASM modules
│   │   ├── assembly/
│   │   │   ├── index.ts         # Main exports
│   │   │   ├── quadtree.ts      # Spatial indexing
│   │   │   ├── viewport.ts      # Viewport & camera
│   │   │   ├── grid.ts          # Grid snapping
│   │   │   ├── commands.ts      # Undo/redo commands
│   │   │   ├── canvas-manager.ts # Main canvas manager
│   │   │   └── tsconfig.json
│   │   ├── build/               # Compiled WASM output
│   │   └── package.json
│   │
│   ├── app/                     # TypeScript frontend
│   │   ├── core/
│   │   │   ├── InfiniteCanvas.ts    # Main canvas class
│   │   │   ├── AssetManager.ts      # Image/video loading
│   │   │   ├── InputHandler.ts      # Mouse/keyboard events
│   │   │   └── Renderer.ts          # Canvas rendering
│   │   ├── types/
│   │   │   └── wasm.d.ts            # WASM type definitions
│   │   └── main.ts                   # Entry point
│   │
│   ├── styles/
│   │   └── main.css
│   └── index.html
│
├── public/
│   └── assets/                  # Sample images/videos
│
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## Setup Instructions

### Step 1: Initialize Project
```bash
mkdir cloudgrid
cd cloudgrid
npm init -y
```

### Step 2: Install Dependencies

**Root package.json:**
```json
{
  "name": "cloudgrid",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "build:wasm": "cd src/wasm && npm run asbuild",
    "dev": "npm run build:wasm && vite",
    "build": "npm run build:wasm && vite build",
    "preview": "vite preview"
  },
  "devDependencies": {
    "vite": "^5.0.0",
    "typescript": "^5.3.0"
  }
}
```

Install root dependencies:
```bash
npm install
```

### Step 3: Setup AssemblyScript WASM Module

Create WASM directory and initialize:
```bash
mkdir -p src/wasm
cd src/wasm
npm init -y
npm install --save-dev assemblyscript
npx asinit .
```

**Update src/wasm/package.json:**
```json
{
  "name": "cloudgrid-wasm",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "asbuild:debug": "asc assembly/index.ts --target debug --outFile build/debug.wasm --exportRuntime --textFile build/debug.wat",
    "asbuild:release": "asc assembly/index.ts --target release --outFile build/optimized.wasm --exportRuntime --optimize --textFile build/optimized.wat",
    "asbuild": "npm run asbuild:debug && npm run asbuild:release"
  },
  "devDependencies": {
    "assemblyscript": "^0.27.0"
  }
}
```

### Step 4: Create AssemblyScript Source Files

**src/wasm/assembly/tsconfig.json:**
```json
{
  "extends": "assemblyscript/std/assembly.json",
  "include": ["./**/*.ts"]
}
```

**src/wasm/assembly/index.ts:**
```typescript
// Export all public APIs
export { AABB, CanvasObject } from './quadtree';
export { Quadtree } from './quadtree';
export { Camera, Viewport } from './viewport';
export { GridSystem } from './grid';
export { CommandHistory, MoveCommand, AddObjectCommand, DeleteObjectCommand } from './commands';
export { InfiniteCanvas, createCanvas } from './canvas-manager';
```

**src/wasm/assembly/quadtree.ts:**
```typescript
// Axis-Aligned Bounding Box
export class AABB {
  x: f32;
  y: f32;
  width: f32;
  height: f32;
  
  constructor(x: f32, y: f32, width: f32, height: f32) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }
  
  intersects(other: AABB): bool {
    return !(this.x + this.width < other.x ||
             other.x + other.width < this.x ||
             this.y + this.height < other.y ||
             other.y + other.height < this.y);
  }
  
  contains(x: f32, y: f32): bool {
    return x >= this.x && x <= this.x + this.width &&
           y >= this.y && y <= this.y + this.height;
  }
}

// Canvas object (image, video, shape, text)
export class CanvasObject {
  id: u32;
  x: f32;
  y: f32;
  width: f32;
  height: f32;
  rotation: f32;
  zIndex: i32;
  objectType: u8;
  assetId: u32;
  visible: bool;
  
  constructor(id: u32, x: f32, y: f32, width: f32, height: f32) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.rotation = 0;
    this.zIndex = 0;
    this.objectType = 0;
    this.assetId = 0;
    this.visible = false;
  }
  
  getBounds(): AABB {
    if (this.rotation != 0) {
      return this.getRotatedBounds();
    }
    return new AABB(this.x, this.y, this.width, this.height);
  }
  
  private getRotatedBounds(): AABB {
    const cos = Mathf.cos(this.rotation);
    const sin = Mathf.sin(this.rotation);
    
    const corners: StaticArray<f32> = [
      this.x, this.y,
      this.x + this.width, this.y,
      this.x + this.width, this.y + this.height,
      this.x, this.y + this.height
    ];
    
    let minX: f32 = Infinity, minY: f32 = Infinity;
    let maxX: f32 = -Infinity, maxY: f32 = -Infinity;
    
    for (let i = 0; i < 8; i += 2) {
      const x = corners[i];
      const y = corners[i + 1];
      
      const rx = x * cos - y * sin;
      const ry = x * sin + y * cos;
      
      minX = Mathf.min(minX, rx);
      minY = Mathf.min(minY, ry);
      maxX = Mathf.max(maxX, rx);
      maxY = Mathf.max(maxY, ry);
    }
    
    return new AABB(minX, minY, maxX - minX, maxY - minY);
  }
}

// Quadtree node
class QuadtreeNode {
  boundary: AABB;
  capacity: i32;
  objects: Array<CanvasObject>;
  divided: bool;
  
  northeast: QuadtreeNode | null = null;
  northwest: QuadtreeNode | null = null;
  southeast: QuadtreeNode | null = null;
  southwest: QuadtreeNode | null = null;
  
  constructor(boundary: AABB, capacity: i32) {
    this.boundary = boundary;
    this.capacity = capacity;
    this.objects = new Array<CanvasObject>();
    this.divided = false;
  }
  
  insert(obj: CanvasObject): bool {
    if (!this.boundary.intersects(obj.getBounds())) {
      return false;
    }
    
    if (this.objects.length < this.capacity && !this.divided) {
      this.objects.push(obj);
      return true;
    }
    
    if (!this.divided) {
      this.subdivide();
    }
    
    if (this.northeast!.insert(obj)) return true;
    if (this.northwest!.insert(obj)) return true;
    if (this.southeast!.insert(obj)) return true;
    if (this.southwest!.insert(obj)) return true;
    
    return false;
  }
  
  private subdivide(): void {
    const x = this.boundary.x;
    const y = this.boundary.y;
    const w = this.boundary.width / 2;
    const h = this.boundary.height / 2;
    
    this.northeast = new QuadtreeNode(new AABB(x + w, y, w, h), this.capacity);
    this.northwest = new QuadtreeNode(new AABB(x, y, w, h), this.capacity);
    this.southeast = new QuadtreeNode(new AABB(x + w, y + h, w, h), this.capacity);
    this.southwest = new QuadtreeNode(new AABB(x, y + h, w, h), this.capacity);
    
    this.divided = true;
    
    for (let i = 0; i < this.objects.length; i++) {
      const obj = this.objects[i];
      this.northeast!.insert(obj);
      this.northwest!.insert(obj);
      this.southeast!.insert(obj);
      this.southwest!.insert(obj);
    }
    
    this.objects = new Array<CanvasObject>();
  }
  
  query(range: AABB, found: Array<CanvasObject>): void {
    if (!this.boundary.intersects(range)) {
      return;
    }
    
    for (let i = 0; i < this.objects.length; i++) {
      const obj = this.objects[i];
      if (range.intersects(obj.getBounds())) {
        found.push(obj);
      }
    }
    
    if (this.divided) {
      this.northeast!.query(range, found);
      this.northwest!.query(range, found);
      this.southeast!.query(range, found);
      this.southwest!.query(range, found);
    }
  }
  
  remove(objectId: u32): bool {
    for (let i = 0; i < this.objects.length; i++) {
      if (this.objects[i].id === objectId) {
        this.objects.splice(i, 1);
        return true;
      }
    }
    
    if (this.divided) {
      if (this.northeast!.remove(objectId)) return true;
      if (this.northwest!.remove(objectId)) return true;
      if (this.southeast!.remove(objectId)) return true;
      if (this.southwest!.remove(objectId)) return true;
    }
    
    return false;
  }
}

export class Quadtree {
  root: QuadtreeNode;
  
  constructor(x: f32, y: f32, width: f32, height: f32, capacity: i32 = 4) {
    this.root = new QuadtreeNode(new AABB(x, y, width, height), capacity);
  }
  
  insert(obj: CanvasObject): void {
    this.root.insert(obj);
  }
  
  queryViewport(viewport: AABB): Array<CanvasObject> {
    const found = new Array<CanvasObject>();
    this.root.query(viewport, found);
    return found;
  }
  
  remove(objectId: u32): void {
    this.root.remove(objectId);
  }
  
  rebuild(objects: Array<CanvasObject>): void {
    const bounds = this.root.boundary;
    this.root = new QuadtreeNode(bounds, 4);
    for (let i = 0; i < objects.length; i++) {
      this.root.insert(objects[i]);
    }
  }
}
```

**src/wasm/assembly/viewport.ts:**
```typescript
import { AABB, CanvasObject, Quadtree } from './quadtree';

export class Camera {
  x: f32;
  y: f32;
  zoom: f32;
  
  constructor() {
    this.x = 0;
    this.y = 0;
    this.zoom = 1.0;
  }
  
  pan(dx: f32, dy: f32): void {
    this.x += dx / this.zoom;
    this.y += dy / this.zoom;
  }
  
  zoomAt(centerX: f32, centerY: f32, delta: f32): void {
    const oldZoom = this.zoom;
    this.zoom = Mathf.max(0.1, Mathf.min(10.0, this.zoom + delta));
    
    const zoomRatio = this.zoom / oldZoom;
    this.x = centerX - (centerX - this.x) * zoomRatio;
    this.y = centerY - (centerY - this.y) * zoomRatio;
  }
  
  screenToWorld(screenX: f32, screenY: f32, canvasWidth: f32, canvasHeight: f32): StaticArray<f32> {
    const worldX = this.x + (screenX - canvasWidth / 2) / this.zoom;
    const worldY = this.y + (screenY - canvasHeight / 2) / this.zoom;
    
    const result = new StaticArray<f32>(2);
    result[0] = worldX;
    result[1] = worldY;
    return result;
  }
  
  getViewportBounds(canvasWidth: f32, canvasHeight: f32): AABB {
    const worldWidth = canvasWidth / this.zoom;
    const worldHeight = canvasHeight / this.zoom;
    
    return new AABB(
      this.x - worldWidth / 2,
      this.y - worldHeight / 2,
      worldWidth,
      worldHeight
    );
  }
}

export class Viewport {
  camera: Camera;
  quadtree: Quadtree;
  canvasWidth: f32;
  canvasHeight: f32;
  visibleObjects: Array<CanvasObject>;
  
  constructor(canvasWidth: f32, canvasHeight: f32) {
    this.camera = new Camera();
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.quadtree = new Quadtree(-100000, -100000, 200000, 200000);
    this.visibleObjects = new Array<CanvasObject>();
  }
  
  updateVisibleObjects(): i32 {
    const viewport = this.camera.getViewportBounds(
      this.canvasWidth,
      this.canvasHeight
    );
    
    this.visibleObjects = this.quadtree.queryViewport(viewport);
    this.sortByZIndex();
    
    return this.visibleObjects.length;
  }
  
  private sortByZIndex(): void {
    for (let i = 1; i < this.visibleObjects.length; i++) {
      const key = this.visibleObjects[i];
      let j = i - 1;
      
      while (j >= 0 && this.visibleObjects[j].zIndex > key.zIndex) {
        this.visibleObjects[j + 1] = this.visibleObjects[j];
        j--;
      }
      this.visibleObjects[j + 1] = key;
    }
  }
  
  getVisibleObjectData(): Uint32Array {
    const count = this.visibleObjects.length;
    const data = new Uint32Array(count * 3);
    
    for (let i = 0; i < count; i++) {
      const obj = this.visibleObjects[i];
      data[i * 3] = obj.id;
      data[i * 3 + 1] = obj.assetId;
      data[i * 3 + 2] = obj.objectType;
    }
    
    return data;
  }
  
  getTransformData(): Float32Array {
    const count = this.visibleObjects.length;
    const data = new Float32Array(count * 5);
    
    for (let i = 0; i < count; i++) {
      const obj = this.visibleObjects[i];
      
      const screenX = (obj.x - this.camera.x) * this.camera.zoom + this.canvasWidth / 2;
      const screenY = (obj.y - this.camera.y) * this.camera.zoom + this.canvasHeight / 2;
      const screenWidth = obj.width * this.camera.zoom;
      const screenHeight = obj.height * this.camera.zoom;
      
      data[i * 5] = screenX;
      data[i * 5 + 1] = screenY;
      data[i * 5 + 2] = screenWidth;
      data[i * 5 + 3] = screenHeight;
      data[i * 5 + 4] = obj.rotation;
    }
    
    return data;
  }
}
```

**src/wasm/assembly/grid.ts:**
```typescript
import { AABB, CanvasObject } from './quadtree';

export class GridSystem {
  gridSize: f32;
  snapEnabled: bool;
  
  constructor(gridSize: f32) {
    this.gridSize = gridSize;
    this.snapEnabled = true;
  }
  
  snap(x: f32, y: f32): StaticArray<f32> {
    const result = new StaticArray<f32>(2);
    
    if (this.snapEnabled) {
      result[0] = Mathf.round(x / this.gridSize) * this.gridSize;
      result[1] = Mathf.round(y / this.gridSize) * this.gridSize;
    } else {
      result[0] = x;
      result[1] = y;
    }
    
    return result;
  }
  
  snapObject(obj: CanvasObject): void {
    if (!this.snapEnabled) return;
    
    obj.x = Mathf.round(obj.x / this.gridSize) * this.gridSize;
    obj.y = Mathf.round(obj.y / this.gridSize) * this.gridSize;
    obj.width = Mathf.round(obj.width / this.gridSize) * this.gridSize;
    obj.height = Mathf.round(obj.height / this.gridSize) * this.gridSize;
  }
  
  setSnapEnabled(enabled: bool): void {
    this.snapEnabled = enabled;
  }
  
  setGridSize(size: f32): void {
    this.gridSize = size;
  }
}
```

**src/wasm/assembly/commands.ts:**
```typescript
import { CanvasObject, Quadtree } from './quadtree';

export abstract class Command {
  abstract execute(): void;
  abstract undo(): void;
}

export class MoveCommand extends Command {
  objectId: u32;
  oldX: f32;
  oldY: f32;
  newX: f32;
  newY: f32;
  objects: Map<u32, CanvasObject>;
  
  constructor(
    objectId: u32,
    oldX: f32, oldY: f32,
    newX: f32, newY: f32,
    objects: Map<u32, CanvasObject>
  ) {
    super();
    this.objectId = objectId;
    this.oldX = oldX;
    this.oldY = oldY;
    this.newX = newX;
    this.newY = newY;
    this.objects = objects;
  }
  
  execute(): void {
    const obj = this.objects.get(this.objectId);
    if (obj) {
      obj.x = this.newX;
      obj.y = this.newY;
    }
  }
  
  undo(): void {
    const obj = this.objects.get(this.objectId);
    if (obj) {
      obj.x = this.oldX;
      obj.y = this.oldY;
    }
  }
}

export class AddObjectCommand extends Command {
  object: CanvasObject;
  objects: Map<u32, CanvasObject>;
  quadtree: Quadtree;
  
  constructor(
    object: CanvasObject,
    objects: Map<u32, CanvasObject>,
    quadtree: Quadtree
  ) {
    super();
    this.object = object;
    this.objects = objects;
    this.quadtree = quadtree;
  }
  
  execute(): void {
    this.objects.set(this.object.id, this.object);
    this.quadtree.insert(this.object);
  }
  
  undo(): void {
    this.objects.delete(this.object.id);
    this.quadtree.remove(this.object.id);
  }
}

export class DeleteObjectCommand extends Command {
  object: CanvasObject;
  objects: Map<u32, CanvasObject>;
  quadtree: Quadtree;
  
  constructor(
    object: CanvasObject,
    objects: Map<u32, CanvasObject>,
    quadtree: Quadtree
  ) {
    super();
    this.object = object;
    this.objects = objects;
    this.quadtree = quadtree;
  }
  
  execute(): void {
    this.objects.delete(this.object.id);
    this.quadtree.remove(this.object.id);
  }
  
  undo(): void {
    this.objects.set(this.object.id, this.object);
    this.quadtree.insert(this.object);
  }
}

export class CommandHistory {
  history: Array<Command>;
  currentIndex: i32;
  maxHistory: i32;
  
  constructor(maxHistory: i32 = 100) {
    this.history = new Array<Command>();
    this.currentIndex = -1;
    this.maxHistory = maxHistory;
  }
  
  execute(command: Command): void {
    while (this.history.length > this.currentIndex + 1) {
      this.history.pop();
    }
    
    command.execute();
    this.history.push(command);
    this.currentIndex++;
    
    if (this.history.length > this.maxHistory) {
      this.history.shift();
      this.currentIndex--;
    }
  }
  
  undo(): bool {
    if (this.currentIndex < 0) return false;
    
    this.history[this.currentIndex].undo();
    this.currentIndex--;
    return true;
  }
  
  redo(): bool {
    if (this.currentIndex >= this.history.length - 1) return false;
    
    this.currentIndex++;
    this.history[this.currentIndex].execute();
    return true;
  }
  
  canUndo(): bool {
    return this.currentIndex >= 0;
  }
  
  canRedo(): bool {
    return this.currentIndex < this.history.length - 1;
  }
}
```

**src/wasm/assembly/canvas-manager.ts:**
```typescript
import { CanvasObject, Quadtree } from './quadtree';
import { Viewport } from './viewport';
import { GridSystem } from './grid';
import { CommandHistory, MoveCommand, AddObjectCommand, DeleteObjectCommand } from './commands';

export class InfiniteCanvas {
  viewport: Viewport;
  grid: GridSystem;
  commandHistory: CommandHistory;
  objects: Map<u32, CanvasObject>;
  nextObjectId: u32;
  
  constructor(canvasWidth: f32, canvasHeight: f32, gridSize: f32) {
    this.viewport = new Viewport(canvasWidth, canvasHeight);
    this.grid = new GridSystem(gridSize);
    this.commandHistory = new CommandHistory();
    this.objects = new Map<u32, CanvasObject>();
    this.nextObjectId = 1;
  }
  
  addObject(x: f32, y: f32, width: f32, height: f32, assetId: u32, objectType: u8): u32 {
    const obj = new CanvasObject(this.nextObjectId++, x, y, width, height);
    obj.assetId = assetId;
    obj.objectType = objectType;
    
    this.grid.snapObject(obj);
    
    const cmd = new AddObjectCommand(obj, this.objects, this.viewport.quadtree);
    this.commandHistory.execute(cmd);
    
    return obj.id;
  }
  
  moveObject(objectId: u32, newX: f32, newY: f32): void {
    const obj = this.objects.get(objectId);
    if (!obj) return;
    
    const oldX = obj.x;
    const oldY = obj.y;
    
    const snapped = this.grid.snap(newX, newY);
    
    const cmd = new MoveCommand(
      objectId,
      oldX, oldY,
      snapped[0], snapped[1],
      this.objects
    );
    this.commandHistory.execute(cmd);
    
    this.viewport.quadtree.remove(objectId);
    this.viewport.quadtree.insert(obj);
  }
  
  deleteObject(objectId: u32): void {
    const obj = this.objects.get(objectId);
    if (!obj) return;
    
    const cmd = new DeleteObjectCommand(obj, this.objects, this.viewport.quadtree);
    this.commandHistory.execute(cmd);
  }
  
  pan(dx: f32, dy: f32): void {
    this.viewport.camera.pan(dx, dy);
  }
  
  zoom(centerX: f32, centerY: f32, delta: f32): void {
    this.viewport.camera.zoomAt(centerX, centerY, delta);
  }
  
  updateViewport(): i32 {
    return this.viewport.updateVisibleObjects();
  }
  
  getVisibleObjectData(): Uint32Array {
    return this.viewport.getVisibleObjectData();
  }
  
  getTransformData(): Float32Array {
    return this.viewport.getTransformData();
  }
  
  undo(): bool {
    const result = this.commandHistory.undo();
    if (result) {
      this.rebuildQuadtree();
    }
    return result;
  }
  
  redo(): bool {
    const result = this.commandHistory.redo();
    if (result) {
      this.rebuildQuadtree();
    }
    return result;
  }
  
  setGridSnap(enabled: bool): void {
    this.grid.setSnapEnabled(enabled);
  }
  
  setGridSize(size: f32): void {
    this.grid.setGridSize(size);
  }
  
  private rebuildQuadtree(): void {
    const allObjects = this.objects.values();
    this.viewport.quadtree.rebuild(allObjects);
  }
}

export function createCanvas(width: f32, height: f32, gridSize: f32): InfiniteCanvas {
  return new InfiniteCanvas(width, height, gridSize);
}
```

### Step 5: Frontend TypeScript Setup

**Root tsconfig.json:**
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,

    /* Bundler mode */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,

    /* Linting */
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src/app"]
}
```

**vite.config.ts:**
```typescript
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/app'),
      '@wasm': path.resolve(__dirname, './src/wasm/build'),
    },
  },
  server: {
    port: 3000,
  },
});
```

**src/index.html:**
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CloudGrid - Infinite Canvas</title>
  <link rel="stylesheet" href="/src/styles/main.css">
</head>
<body>
  <div id="app">
    <div class="toolbar">
      <button id="addImage">Add Image</button>
      <button id="undo">Undo (Ctrl+Z)</button>
      <button id="redo">Redo (Ctrl+Shift+Z)</button>
      <label>
        <input type="checkbox" id="gridSnap" checked> Grid Snap
      </label>
      <label>
        Grid Size: <input type="number" id="gridSize" value="20" min="5" max="100">
      </label>
      <div id="stats">
        <span>Visible: <span id="visibleCount">0</span></span> |
        <span>Total: <span id="totalCount">0</span></span> |
        <span>FPS: <span id="fps">0</span></span>
      </div>
    </div>
    <canvas id="canvas"></canvas>
  </div>
  <script type="module" src="/src/app/main.ts"></script>
</body>
</html>
```

**src/styles/main.css:**
```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  overflow: hidden;
}

#app {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.toolbar {
  background: #f5f5f5;
  padding: 12px;
  border-bottom: 1px solid #ddd;
  display: flex;
  gap: 12px;
  align-items: center;
}

button {
  padding: 8px 16px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

button:hover {
  background: #0056b3;
}

button:active {
  transform: translateY(1px);
}

label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

input[type="number"] {
  width: 60px;
  padding: 4px 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
}

#stats {
  margin-left: auto;
  font-size: 14px;
  color: #666;
}

#canvas {
  flex: 1;
  background: #fff;
  cursor: grab;
}

#canvas:active {
  cursor: grabbing;
}
```

**src/app/types/wasm.d.ts:**
```typescript
export interface InfiniteCanvas {
  addObject(x: number, y: number, width: number, height: number, assetId: number, objectType: number): number;
  moveObject(objectId: number, x: number, y: number): void;
  deleteObject(objectId: number): void;
  pan(dx: number, dy: number): void;
  zoom(centerX: number, centerY: number, delta: number): void;
  updateViewport(): number;
  getVisibleObjectData(): Uint32Array;
  getTransformData(): Float32Array;
  undo(): boolean;
  redo(): boolean;
  setGridSnap(enabled: boolean): void;
  setGridSize(size: number): void;
}

export interface WASMExports {
  createCanvas(width: number, height: number, gridSize: number): InfiniteCanvas;
  memory: WebAssembly.Memory;
}

export function instantiate(): Promise<WASMExports>;
```

**src/app/core/AssetManager.ts:**
```typescript
export type AssetType = 'image' | 'video';

export interface Asset {
  id: number;
  type: AssetType;
  element: HTMLImageElement | HTMLVideoElement;
  url: string;
}

export class AssetManager {
  private assets: Map<number, Asset> = new Map();
  private nextAssetId = 1;

  async loadImage(url: string): Promise<number> {
    const img = new Image();
    
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
      img.src = url;
    });

    const assetId = this.nextAssetId++;
    this.assets.set(assetId, {
      id: assetId,
      type: 'image',
      element: img,
      url,
    });

    return assetId;
  }

  async loadVideo(url: string): Promise<number> {
    const video = document.createElement('video');
    video.src = url;
    video.muted = true;
    video.loop = true;

    await new Promise<void>((resolve) => {
      video.addEventListener('loadeddata', () => resolve(), { once: true });
      video.load();
    });

    const assetId = this.nextAssetId++;
    this.assets.set(assetId, {
      id: assetId,
      type: 'video',
      element: video,
      url,
    });

    return assetId;
  }

  getAsset(assetId: number): Asset | undefined {
    return this.assets.get(assetId);
  }

  getAllAssets(): Asset[] {
    return Array.from(this.assets.values());
  }

  removeAsset(assetId: number): void {
    this.assets.delete(assetId);
  }
}
```

**src/app/core/InputHandler.ts:**
```typescript
import type { InfiniteCanvas } from '../types/wasm';

export class InputHandler {
  private canvas: HTMLCanvasElement;
  private wasmCanvas: InfiniteCanvas;
  private isDragging = false;
  private dragStart = { x: 0, y: 0 };
  private onUpdate: () => void;

  constructor(canvas: HTMLCanvasElement, wasmCanvas: InfiniteCanvas, onUpdate: () => void) {
    this.canvas = canvas;
    this.wasmCanvas = wasmCanvas;
    this.onUpdate = onUpdate;
    this.setupListeners();
  }

  private setupListeners(): void {
    this.canvas.addEventListener('mousedown', this.onMouseDown);
    this.canvas.addEventListener('mousemove', this.onMouseMove);
    this.canvas.addEventListener('mouseup', this.onMouseUp);
    this.canvas.addEventListener('mouseleave', this.onMouseUp);
    this.canvas.addEventListener('wheel', this.onWheel);
    
    document.addEventListener('keydown', this.onKeyDown);
  }

  private onMouseDown = (e: MouseEvent): void => {
    this.isDragging = true;
    this.dragStart = { x: e.clientX, y: e.clientY };
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (!this.isDragging) return;

    const dx = e.clientX - this.dragStart.x;
    const dy = e.clientY - this.dragStart.y;

    this.wasmCanvas.pan(-dx, -dy);
    
    this.dragStart = { x: e.clientX, y: e.clientY };
  };

  private onMouseUp = (): void => {
    this.isDragging = false;
  };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    
    const delta = -e.deltaY * 0.001;
    this.wasmCanvas.zoom(e.clientX, e.clientY, delta);
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        this.wasmCanvas.undo();
        this.onUpdate();
      } else if (e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        this.wasmCanvas.redo();
        this.onUpdate();
      }
    }
  };

  destroy(): void {
    this.canvas.removeEventListener('mousedown', this.onMouseDown);
    this.canvas.removeEventListener('mousemove', this.onMouseMove);
    this.canvas.removeEventListener('mouseup', this.onMouseUp);
    this.canvas.removeEventListener('mouseleave', this.onMouseUp);
    this.canvas.removeEventListener('wheel', this.onWheel);
    document.removeEventListener('keydown', this.onKeyDown);
  }
}
```

**src/app/core/Renderer.ts:**
```typescript
import type { InfiniteCanvas } from '../types/wasm';
import type { AssetManager } from './AssetManager';

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private wasmCanvas: InfiniteCanvas;
  private assetManager: AssetManager;
  private lastFrameTime = 0;
  private fps = 0;

  constructor(
    ctx: CanvasRenderingContext2D,
    wasmCanvas: InfiniteCanvas,
    assetManager: AssetManager
  ) {
    this.ctx = ctx;
    this.wasmCanvas = wasmCanvas;
    this.assetManager = assetManager;
  }

  render(time: number): void {
    // Calculate FPS
    if (this.lastFrameTime) {
      const delta = time - this.lastFrameTime;
      this.fps = Math.round(1000 / delta);
    }
    this.lastFrameTime = time;

    // Update visible objects in WASM
    const visibleCount = this.wasmCanvas.updateViewport();

    // Clear canvas
    this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);

    if (visibleCount === 0) return;

    // Get data from WASM
    const objectData = this.wasmCanvas.getVisibleObjectData();
    const transformData = this.wasmCanvas.getTransformData();

    // Render each visible object
    for (let i = 0; i < visibleCount; i++) {
      const assetId = objectData[i * 3 + 1];
      const asset = this.assetManager.getAsset(assetId);
      if (!asset) continue;

      const x = transformData[i * 5];
      const y = transformData[i * 5 + 1];
      const width = transformData[i * 5 + 2];
      const height = transformData[i * 5 + 3];
      const rotation = transformData[i * 5 + 4];

      this.ctx.save();
      
      if (rotation !== 0) {
        this.ctx.translate(x + width / 2, y + height / 2);
        this.ctx.rotate(rotation);
        this.ctx.drawImage(asset.element, -width / 2, -height / 2, width, height);
      } else {
        this.ctx.drawImage(asset.element, x, y, width, height);
      }
      
      this.ctx.restore();
    }
  }

  getFPS(): number {
    return this.fps;
  }
}
```

**src/app/core/InfiniteCanvas.ts:**
```typescript
import type { InfiniteCanvas as WASMCanvas, WASMExports } from '../types/wasm';
import { AssetManager } from './AssetManager';
import { InputHandler } from './InputHandler';
import { Renderer } from './Renderer';

export class InfiniteCanvasApp {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private wasmCanvas!: WASMCanvas;
  private assetManager: AssetManager;
  private inputHandler!: InputHandler;
  private renderer!: Renderer;
  private animationId = 0;
  private totalObjects = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get 2D context');
    this.ctx = ctx;

    this.assetManager = new AssetManager();
    
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
  }

  async init(wasmModule: WASMExports): Promise<void> {
    this.wasmCanvas = wasmModule.createCanvas(
      this.canvas.width,
      this.canvas.height,
      20
    );

    this.inputHandler = new InputHandler(
      this.canvas,
      this.wasmCanvas,
      () => this.updateStats()
    );

    this.renderer = new Renderer(this.ctx, this.wasmCanvas, this.assetManager);

    this.startRenderLoop();
  }

  async addImage(url: string, x: number, y: number, width: number, height: number): Promise<number> {
    const assetId = await this.assetManager.loadImage(url);
    const objectId = this.wasmCanvas.addObject(x, y, width, height, assetId, 0);
    this.totalObjects++;
    this.updateStats();
    return objectId;
  }

  private resizeCanvas(): void {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();

    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    
    this.ctx.scale(dpr, dpr);
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;
  }

  private startRenderLoop(): void {
    const render = (time: number) => {
      this.renderer.render(time);
      this.updateStats();
      this.animationId = requestAnimationFrame(render);
    };
    this.animationId = requestAnimationFrame(render);
  }

  private updateStats(): void {
    const visibleCount = this.wasmCanvas.updateViewport();
    
    const visibleEl = document.getElementById('visibleCount');
    const totalEl = document.getElementById('totalCount');
    const fpsEl = document.getElementById('fps');

    if (visibleEl) visibleEl.textContent = visibleCount.toString();
    if (totalEl) totalEl.textContent = this.totalObjects.toString();
    if (fpsEl) fpsEl.textContent = this.renderer.getFPS().toString();
  }

  setGridSnap(enabled: boolean): void {
    this.wasmCanvas.setGridSnap(enabled);
  }

  setGridSize(size: number): void {
    this.wasmCanvas.setGridSize(size);
  }

  destroy(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    this.inputHandler.destroy();
  }
}
```

**src/app/main.ts:**
```typescript
import { InfiniteCanvasApp } from './core/InfiniteCanvas';

async function main() {
  const canvas = document.getElementById('canvas') as HTMLCanvasElement;
  if (!canvas) {
    throw new Error('Canvas element not found');
  }

  // Load WASM module
  const wasmModule = await import('@wasm/optimized.js');
  const wasm = await wasmModule.instantiate();

  // Create app
  const app = new InfiniteCanvasApp(canvas);
  await app.init(wasm);

  // Setup UI controls
  const addImageBtn = document.getElementById('addImage');
  const undoBtn = document.getElementById('undo');
  const redoBtn = document.getElementById('redo');
  const gridSnapInput = document.getElementById('gridSnap') as HTMLInputElement;
  const gridSizeInput = document.getElementById('gridSize') as HTMLInputElement;

  if (addImageBtn) {
    addImageBtn.addEventListener('click', async () => {
      const x = Math.random() * 2000 - 1000;
      const y = Math.random() * 2000 - 1000;
      await app.addImage('https://picsum.photos/300/200', x, y, 300, 200);
    });
  }

  if (undoBtn) {
    undoBtn.addEventListener('click', () => {
      // Undo is handled by keyboard shortcut
    });
  }

  if (redoBtn) {
    redoBtn.addEventListener('click', () => {
      // Redo is handled by keyboard shortcut
    });
  }

  if (gridSnapInput) {
    gridSnapInput.addEventListener('change', (e) => {
      app.setGridSnap((e.target as HTMLInputElement).checked);
    });
  }

  if (gridSizeInput) {
    gridSizeInput.addEventListener('change', (e) => {
      const size = parseInt((e.target as HTMLInputElement).value);
      app.setGridSize(size);
    });
  }

  // Add some initial objects
  const initialImages = [
    { x: 0, y: 0, w: 400, h: 300 },
    { x: 500, y: 200, w: 300, h: 200 },
    { x: -600, y: -400, w: 500, h: 350 },
    { x: 800, y: -300, w: 250, h: 250 },
  ];

  for (const img of initialImages) {
    await app.addImage('https://picsum.photos/300/200', img.x, img.y, img.w, img.h);
  }

  console.log('CloudGrid initialized!');
}

main().catch(console.error);
```

### Step 6: Build and Run

**Build commands:**
```bash
# From project root
npm run build:wasm    # Build WASM module
npm run dev           # Run dev server
npm run build         # Production build
```

### Step 7: Testing the Application

1. Run `npm run dev`
2. Open browser to `http://localhost:3000`
3. You should see:
   - 4 initial images on the canvas
   - Ability to pan (drag) and zoom (scroll)
   - Grid snapping enabled by default
   - Undo/redo with Ctrl+Z / Ctrl+Shift+Z
   - Add more images with button
   - Stats showing visible/total objects and FPS

### Performance Benchmarks to Expect

- **100 objects**: 60 FPS, ~2ms culling
- **1,000 objects**: 60 FPS, ~3ms culling
- **10,000 objects**: 60 FPS, ~5ms culling
- **100,000 objects**: 50-60 FPS, ~10ms culling

### Next Steps for Enhancement

1. **Video support**: Extend AssetManager with video loading
2. **SIMD optimization**: Add SIMD to transform calculations
3. **WebWorker**: Move WASM to worker thread
4. **Persistence**: Save/load canvas state
5. **Collaborative editing**: Add WebSocket sync
6. **Advanced operations**: Rotate, resize, layers

### Troubleshooting

**WASM build fails:**
- Ensure AssemblyScript is installed: `cd src/wasm && npm install`
- Check tsconfig.json is correct

**Canvas not rendering:**
- Check browser console for errors
- Verify WASM module loaded: check Network tab
- Ensure assets are loading (check URLs)

**Performance issues:**
- Check object count - reduce if >50k
- Verify quadtree is working (check stats)
- Profile with Chrome DevTools

## Resources

- AssemblyScript Docs: https://www.assemblyscript.org/
- WebAssembly Docs: https://webassembly.org/
- Vite Docs: https://vitejs.dev/
- TypeScript Docs: https://www.typescriptlang.org/

## License

MIT