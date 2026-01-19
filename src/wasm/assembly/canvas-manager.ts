import { CanvasObject, Quadtree } from './quadtree';
import { Viewport } from './viewport';
import { GridSystem } from './grid';
import { CommandHistory, MoveCommand, AddObjectCommand, DeleteObjectCommand } from './commands';

class InfiniteCanvas {
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
}

// Global canvas instance
let canvas: InfiniteCanvas | null = null;

export function createCanvas(width: f32, height: f32, gridSize: f32): void {
  canvas = new InfiniteCanvas(width, height, gridSize);
}

export function addObject(x: f32, y: f32, width: f32, height: f32, assetId: u32, objectType: u8): u32 {
  if (!canvas) return 0;
  const c = canvas!;
  
  const obj = new CanvasObject(c.nextObjectId++, x, y, width, height);
  obj.assetId = assetId;
  obj.objectType = objectType;
  
  c.grid.snapObject(obj);
  
  const cmd = new AddObjectCommand(obj, c.objects, c.viewport.quadtree);
  c.commandHistory.execute(cmd);
  
  return obj.id;
}

export function moveObject(objectId: u32, newX: f32, newY: f32): void {
  if (!canvas) return;
  const c = canvas!;
  
  const obj = c.objects.get(objectId);
  if (!obj) return;
  
  const oldX = obj.x;
  const oldY = obj.y;
  
  const snapped = c.grid.snap(newX, newY);
  
  const cmd = new MoveCommand(
    objectId,
    oldX, oldY,
    snapped[0], snapped[1],
    c.objects
  );
  c.commandHistory.execute(cmd);
  
  c.viewport.quadtree.remove(objectId);
  c.viewport.quadtree.insert(obj);
}

export function deleteObject(objectId: u32): void {
  if (!canvas) return;
  const c = canvas!;
  
  const obj = c.objects.get(objectId);
  if (!obj) return;
  
  const cmd = new DeleteObjectCommand(obj, c.objects, c.viewport.quadtree);
  c.commandHistory.execute(cmd);
}

export function pan(dx: f32, dy: f32): void {
  if (!canvas) return;
  canvas!.viewport.camera.pan(dx, dy);
}

export function zoom(centerX: f32, centerY: f32, delta: f32): void {
  if (!canvas) return;
  canvas!.viewport.camera.zoomAt(centerX, centerY, delta);
}

export function updateViewport(): i32 {
  if (!canvas) return 0;
  return canvas!.viewport.updateVisibleObjects();
}

export function getVisibleCount(): i32 {
  if (!canvas) return 0;
  return canvas!.viewport.visibleObjects.length;
}

export function getVisibleObjectId(index: i32): u32 {
  if (!canvas) return 0;
  const c = canvas!;
  if (index < 0 || index >= c.viewport.visibleObjects.length) return 0;
  return c.viewport.visibleObjects[index].id;
}

export function getVisibleObjectAssetId(index: i32): u32 {
  if (!canvas) return 0;
  const c = canvas!;
  if (index < 0 || index >= c.viewport.visibleObjects.length) return 0;
  return c.viewport.visibleObjects[index].assetId;
}

export function getVisibleObjectType(index: i32): u8 {
  if (!canvas) return 0;
  const c = canvas!;
  if (index < 0 || index >= c.viewport.visibleObjects.length) return 0;
  return c.viewport.visibleObjects[index].objectType;
}

export function getTransformX(index: i32): f32 {
  if (!canvas) return 0;
  const c = canvas!;
  if (index < 0 || index >= c.viewport.visibleObjects.length) return 0;
  const obj = c.viewport.visibleObjects[index];
  return (obj.x - c.viewport.camera.x) * c.viewport.camera.zoom + c.viewport.canvasWidth / 2;
}

export function getTransformY(index: i32): f32 {
  if (!canvas) return 0;
  const c = canvas!;
  if (index < 0 || index >= c.viewport.visibleObjects.length) return 0;
  const obj = c.viewport.visibleObjects[index];
  return (obj.y - c.viewport.camera.y) * c.viewport.camera.zoom + c.viewport.canvasHeight / 2;
}

export function getTransformWidth(index: i32): f32 {
  if (!canvas) return 0;
  const c = canvas!;
  if (index < 0 || index >= c.viewport.visibleObjects.length) return 0;
  const obj = c.viewport.visibleObjects[index];
  return obj.width * c.viewport.camera.zoom;
}

export function getTransformHeight(index: i32): f32 {
  if (!canvas) return 0;
  const c = canvas!;
  if (index < 0 || index >= c.viewport.visibleObjects.length) return 0;
  const obj = c.viewport.visibleObjects[index];
  return obj.height * c.viewport.camera.zoom;
}

export function getTransformRotation(index: i32): f32 {
  if (!canvas) return 0;
  const c = canvas!;
  if (index < 0 || index >= c.viewport.visibleObjects.length) return 0;
  return c.viewport.visibleObjects[index].rotation;
}

export function undo(): bool {
  if (!canvas) return false;
  const c = canvas!;
  const result = c.commandHistory.undo();
  if (result) {
    const allObjects = c.objects.values();
    c.viewport.quadtree.rebuild(allObjects);
  }
  return result;
}

export function redo(): bool {
  if (!canvas) return false;
  const c = canvas!;
  const result = c.commandHistory.redo();
  if (result) {
    const allObjects = c.objects.values();
    c.viewport.quadtree.rebuild(allObjects);
  }
  return result;
}

export function setGridSnap(enabled: bool): void {
  if (!canvas) return;
  canvas!.grid.setSnapEnabled(enabled);
}

export function setGridSize(size: f32): void {
  if (!canvas) return;
  canvas!.grid.setGridSize(size);
}

export function getCameraX(): f32 {
  if (!canvas) return 0;
  return canvas!.viewport.camera.x;
}

export function getCameraY(): f32 {
  if (!canvas) return 0;
  return canvas!.viewport.camera.y;
}

export function getCameraZoom(): f32 {
  if (!canvas) return 1;
  return canvas!.viewport.camera.zoom;
}

export function getGridSize(): f32 {
  if (!canvas) return 20;
  return canvas!.grid.gridSize;
}

export function getCanvasWidth(): f32 {
  if (!canvas) return 0;
  return canvas!.viewport.canvasWidth;
}

export function getCanvasHeight(): f32 {
  if (!canvas) return 0;
  return canvas!.viewport.canvasHeight;
}

export function updateCanvasSize(width: f32, height: f32): void {
  if (!canvas) return;
  canvas!.viewport.canvasWidth = width;
  canvas!.viewport.canvasHeight = height;
}
