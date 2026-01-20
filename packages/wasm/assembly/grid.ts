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
  
  snapValue(value: f32): f32 {
    if (this.snapEnabled) {
      return Mathf.round(value / this.gridSize) * this.gridSize;
    }
    return value;
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
