import { CanvasObject, Quadtree } from './quadtree';
import { Viewport } from './viewport';
import { GridSystem } from './grid';
import { 
  CommandHistory, 
  MoveCommand, 
  BatchMoveCommand,
  BatchResizeCommand,
  ResizeCommand,
  AddObjectCommand, 
  DeleteObjectCommand,
  BatchDeleteCommand 
} from './commands';

class InfiniteCanvas {
  viewport: Viewport;
  grid: GridSystem;
  commandHistory: CommandHistory;
  objects: Map<u32, CanvasObject>;
  objectList: Array<u32>; // Ordered list of object IDs for iteration
  nextObjectId: u32;
  stateVersion: u32; // Incremented on every state change
  
  // Batch operation state
  batchMoveCmd: BatchMoveCommand | null;
  batchResizeCmd: BatchResizeCommand | null;
  
  constructor(canvasWidth: f32, canvasHeight: f32, gridSize: f32) {
    this.viewport = new Viewport(canvasWidth, canvasHeight);
    this.grid = new GridSystem(gridSize);
    this.commandHistory = new CommandHistory();
    this.objects = new Map<u32, CanvasObject>();
    this.objectList = new Array<u32>();
    this.nextObjectId = 1;
    this.stateVersion = 0;
    this.batchMoveCmd = null;
    this.batchResizeCmd = null;
  }
  
  incrementVersion(): void {
    this.stateVersion++;
  }
}

// Global canvas instance
let canvas: InfiniteCanvas | null = null;

// ============= Canvas Lifecycle =============

export function createCanvas(width: f32, height: f32, gridSize: f32): void {
  canvas = new InfiniteCanvas(width, height, gridSize);
}

export function clearCanvas(): void {
  if (!canvas) return;
  const c = canvas!;
  c.objects.clear();
  c.objectList = new Array<u32>();
  c.commandHistory.clear();
  c.viewport.quadtree.rebuild(new Array<CanvasObject>());
  c.incrementVersion();
}

// ============= Object Management =============

export function addObject(x: f32, y: f32, width: f32, height: f32, assetId: u32, objectType: u8): u32 {
  if (!canvas) return 0;
  const c = canvas!;
  
  const obj = new CanvasObject(c.nextObjectId++, x, y, width, height);
  obj.assetId = assetId;
  obj.objectType = objectType;
  
  // Snap to grid
  c.grid.snapObject(obj);
  
  const cmd = new AddObjectCommand(obj, c.objects, c.viewport.quadtree);
  c.commandHistory.execute(cmd);
  c.objectList.push(obj.id);
  
  c.incrementVersion();
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
  
  // Update quadtree
  c.viewport.quadtree.remove(objectId);
  c.viewport.quadtree.insert(obj);
  
  c.incrementVersion();
}

// ============= Batch Operations =============
// Use these for group operations to create a single history entry

// Start a batch move operation
export function beginBatchMove(): void {
  if (!canvas) return;
  const c = canvas!;
  c.batchMoveCmd = new BatchMoveCommand(c.objects);
}

// Add a move to the current batch (call between beginBatchMove and endBatchMove)
export function addToBatchMove(objectId: u32, newX: f32, newY: f32): void {
  if (!canvas) return;
  const c = canvas!;
  if (!c.batchMoveCmd) return;
  
  const obj = c.objects.get(objectId);
  if (!obj) return;
  
  const oldX = obj.x;
  const oldY = obj.y;
  const snapped = c.grid.snap(newX, newY);
  
  c.batchMoveCmd!.addMove(objectId, oldX, oldY, snapped[0], snapped[1]);
}

// End the batch move and commit to history
export function endBatchMove(): void {
  if (!canvas) return;
  const c = canvas!;
  if (!c.batchMoveCmd) return;
  
  if (!c.batchMoveCmd!.isEmpty()) {
    c.commandHistory.execute(c.batchMoveCmd!);
    
    // Update quadtree for all moved objects
    for (let i = 0; i < c.batchMoveCmd!.objectIds.length; i++) {
      const objId = c.batchMoveCmd!.objectIds[i];
      const obj = c.objects.get(objId);
      if (obj) {
        c.viewport.quadtree.remove(objId);
        c.viewport.quadtree.insert(obj);
      }
    }
    
    c.incrementVersion();
  }
  
  c.batchMoveCmd = null;
}

// Start a batch resize operation
export function beginBatchResize(): void {
  if (!canvas) return;
  const c = canvas!;
  c.batchResizeCmd = new BatchResizeCommand(c.objects);
}

// Add a resize to the current batch
export function addToBatchResize(objectId: u32, newX: f32, newY: f32, newWidth: f32, newHeight: f32): void {
  if (!canvas) return;
  const c = canvas!;
  if (!c.batchResizeCmd) return;
  
  const obj = c.objects.get(objectId);
  if (!obj) return;
  
  const oldX = obj.x;
  const oldY = obj.y;
  const oldWidth = obj.width;
  const oldHeight = obj.height;
  
  const snapped = c.grid.snap(newX, newY);
  const snappedWidth = c.grid.snapValue(newWidth);
  const snappedHeight = c.grid.snapValue(newHeight);
  
  c.batchResizeCmd!.addResize(objectId, oldX, oldY, oldWidth, oldHeight, snapped[0], snapped[1], snappedWidth, snappedHeight);
}

// End the batch resize and commit to history
export function endBatchResize(): void {
  if (!canvas) return;
  const c = canvas!;
  if (!c.batchResizeCmd) return;
  
  if (!c.batchResizeCmd!.isEmpty()) {
    c.commandHistory.execute(c.batchResizeCmd!);
    
    // Update quadtree for all resized objects
    for (let i = 0; i < c.batchResizeCmd!.objectIds.length; i++) {
      const objId = c.batchResizeCmd!.objectIds[i];
      const obj = c.objects.get(objId);
      if (obj) {
        c.viewport.quadtree.remove(objId);
        c.viewport.quadtree.insert(obj);
      }
    }
    
    c.incrementVersion();
  }
  
  c.batchResizeCmd = null;
}

// Resize a single object
export function resizeObject(objectId: u32, newX: f32, newY: f32, newWidth: f32, newHeight: f32): void {
  if (!canvas) return;
  const c = canvas!;
  
  const obj = c.objects.get(objectId);
  if (!obj) return;
  
  const oldX = obj.x;
  const oldY = obj.y;
  const oldWidth = obj.width;
  const oldHeight = obj.height;
  
  // Snap position and size to grid
  const snapped = c.grid.snap(newX, newY);
  const snappedWidth = c.grid.snapValue(newWidth);
  const snappedHeight = c.grid.snapValue(newHeight);
  
  const cmd = new ResizeCommand(
    objectId,
    oldX, oldY, oldWidth, oldHeight,
    snapped[0], snapped[1], snappedWidth, snappedHeight,
    c.objects
  );
  c.commandHistory.execute(cmd);
  
  // Update quadtree
  c.viewport.quadtree.remove(objectId);
  c.viewport.quadtree.insert(obj);
  
  c.incrementVersion();
}

export function deleteObject(objectId: u32): void {
  if (!canvas) return;
  const c = canvas!;
  
  const obj = c.objects.get(objectId);
  if (!obj) return;
  
  const cmd = new DeleteObjectCommand(obj, c.objects, c.viewport.quadtree);
  c.commandHistory.execute(cmd);
  
  // Remove from object list
  const idx = c.objectList.indexOf(objectId);
  if (idx >= 0) {
    c.objectList.splice(idx, 1);
  }
  
  c.incrementVersion();
}

// Delete multiple objects with a single history entry
export function deleteObjects(objectIds: StaticArray<u32>): void {
  if (!canvas) return;
  const c = canvas!;
  
  if (objectIds.length === 0) return;
  
  const cmd = new BatchDeleteCommand(objectIds, c.objects, c.viewport.quadtree);
  c.commandHistory.execute(cmd);
  
  // Remove from object list
  for (let i = 0; i < objectIds.length; i++) {
    const idx = c.objectList.indexOf(objectIds[i]);
    if (idx >= 0) {
      c.objectList.splice(idx, 1);
    }
  }
  
  c.incrementVersion();
}

// ============= Object Queries =============

export function getObjectCount(): i32 {
  if (!canvas) return 0;
  return canvas!.objects.size;
}

export function getObjectIdAtIndex(index: i32): u32 {
  if (!canvas) return 0;
  const c = canvas!;
  if (index < 0 || index >= c.objectList.length) return 0;
  return c.objectList[index];
}

export function getObjectX(objectId: u32): f32 {
  if (!canvas) return 0;
  const obj = canvas!.objects.get(objectId);
  return obj ? obj.x : 0;
}

export function getObjectY(objectId: u32): f32 {
  if (!canvas) return 0;
  const obj = canvas!.objects.get(objectId);
  return obj ? obj.y : 0;
}

export function getObjectWidth(objectId: u32): f32 {
  if (!canvas) return 0;
  const obj = canvas!.objects.get(objectId);
  return obj ? obj.width : 0;
}

export function getObjectHeight(objectId: u32): f32 {
  if (!canvas) return 0;
  const obj = canvas!.objects.get(objectId);
  return obj ? obj.height : 0;
}

export function getObjectAssetId(objectId: u32): u32 {
  if (!canvas) return 0;
  const obj = canvas!.objects.get(objectId);
  return obj ? obj.assetId : 0;
}

export function getObjectType(objectId: u32): u8 {
  if (!canvas) return 0;
  const obj = canvas!.objects.get(objectId);
  return obj ? obj.objectType : 0;
}

export function objectExists(objectId: u32): bool {
  if (!canvas) return false;
  return canvas!.objects.has(objectId);
}

// ============= Camera & Viewport =============

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

// ============= History (Undo/Redo) =============

export function undo(): bool {
  if (!canvas) return false;
  const c = canvas!;
  const result = c.commandHistory.undo();
  if (result) {
    // Rebuild quadtree after undo
    const allObjects = c.objects.values();
    c.viewport.quadtree.rebuild(allObjects);
    
    // Sync objectList with current objects
    c.objectList = new Array<u32>();
    const ids = c.objects.keys();
    for (let i = 0; i < ids.length; i++) {
      c.objectList.push(ids[i]);
    }
    
    c.incrementVersion();
  }
  return result;
}

export function redo(): bool {
  if (!canvas) return false;
  const c = canvas!;
  const result = c.commandHistory.redo();
  if (result) {
    // Rebuild quadtree after redo
    const allObjects = c.objects.values();
    c.viewport.quadtree.rebuild(allObjects);
    
    // Sync objectList with current objects
    c.objectList = new Array<u32>();
    const ids = c.objects.keys();
    for (let i = 0; i < ids.length; i++) {
      c.objectList.push(ids[i]);
    }
    
    c.incrementVersion();
  }
  return result;
}

export function canUndo(): bool {
  if (!canvas) return false;
  return canvas!.commandHistory.canUndo();
}

export function canRedo(): bool {
  if (!canvas) return false;
  return canvas!.commandHistory.canRedo();
}

// ============= Grid =============

export function setGridSnap(enabled: bool): void {
  if (!canvas) return;
  canvas!.grid.setSnapEnabled(enabled);
}

export function setGridSize(size: f32): void {
  if (!canvas) return;
  canvas!.grid.setGridSize(size);
}

export function getGridSize(): f32 {
  if (!canvas) return 20;
  return canvas!.grid.gridSize;
}

// ============= State =============

export function getStateVersion(): u32 {
  if (!canvas) return 0;
  return canvas!.stateVersion;
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
