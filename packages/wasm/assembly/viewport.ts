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
