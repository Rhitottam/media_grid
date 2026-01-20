import { CanvasObject, Quadtree } from './quadtree';

export abstract class Command {
  abstract execute(): void;
  abstract undo(): void;
}

// Move a single object
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

// Move multiple objects (group move) - single history entry
export class BatchMoveCommand extends Command {
  objectIds: Array<u32>;
  oldPositions: Array<f32>; // [x1, y1, x2, y2, ...]
  newPositions: Array<f32>;
  objects: Map<u32, CanvasObject>;
  
  constructor(objects: Map<u32, CanvasObject>) {
    super();
    this.objectIds = new Array<u32>();
    this.oldPositions = new Array<f32>();
    this.newPositions = new Array<f32>();
    this.objects = objects;
  }
  
  addMove(objectId: u32, oldX: f32, oldY: f32, newX: f32, newY: f32): void {
    this.objectIds.push(objectId);
    this.oldPositions.push(oldX);
    this.oldPositions.push(oldY);
    this.newPositions.push(newX);
    this.newPositions.push(newY);
  }
  
  isEmpty(): bool {
    return this.objectIds.length === 0;
  }
  
  execute(): void {
    for (let i = 0; i < this.objectIds.length; i++) {
      const obj = this.objects.get(this.objectIds[i]);
      if (obj) {
        obj.x = this.newPositions[i * 2];
        obj.y = this.newPositions[i * 2 + 1];
      }
    }
  }
  
  undo(): void {
    for (let i = 0; i < this.objectIds.length; i++) {
      const obj = this.objects.get(this.objectIds[i]);
      if (obj) {
        obj.x = this.oldPositions[i * 2];
        obj.y = this.oldPositions[i * 2 + 1];
      }
    }
  }
}

// Resize multiple objects (group resize) - single history entry
export class BatchResizeCommand extends Command {
  objectIds: Array<u32>;
  oldData: Array<f32>; // [x1, y1, w1, h1, x2, y2, w2, h2, ...]
  newData: Array<f32>;
  objects: Map<u32, CanvasObject>;
  
  constructor(objects: Map<u32, CanvasObject>) {
    super();
    this.objectIds = new Array<u32>();
    this.oldData = new Array<f32>();
    this.newData = new Array<f32>();
    this.objects = objects;
  }
  
  addResize(objectId: u32, oldX: f32, oldY: f32, oldW: f32, oldH: f32, newX: f32, newY: f32, newW: f32, newH: f32): void {
    this.objectIds.push(objectId);
    this.oldData.push(oldX);
    this.oldData.push(oldY);
    this.oldData.push(oldW);
    this.oldData.push(oldH);
    this.newData.push(newX);
    this.newData.push(newY);
    this.newData.push(newW);
    this.newData.push(newH);
  }
  
  isEmpty(): bool {
    return this.objectIds.length === 0;
  }
  
  execute(): void {
    for (let i = 0; i < this.objectIds.length; i++) {
      const obj = this.objects.get(this.objectIds[i]);
      if (obj) {
        obj.x = this.newData[i * 4];
        obj.y = this.newData[i * 4 + 1];
        obj.width = this.newData[i * 4 + 2];
        obj.height = this.newData[i * 4 + 3];
      }
    }
  }
  
  undo(): void {
    for (let i = 0; i < this.objectIds.length; i++) {
      const obj = this.objects.get(this.objectIds[i]);
      if (obj) {
        obj.x = this.oldData[i * 4];
        obj.y = this.oldData[i * 4 + 1];
        obj.width = this.oldData[i * 4 + 2];
        obj.height = this.oldData[i * 4 + 3];
      }
    }
  }
}

// Resize a single object
export class ResizeCommand extends Command {
  objectId: u32;
  oldX: f32;
  oldY: f32;
  oldWidth: f32;
  oldHeight: f32;
  newX: f32;
  newY: f32;
  newWidth: f32;
  newHeight: f32;
  objects: Map<u32, CanvasObject>;
  
  constructor(
    objectId: u32,
    oldX: f32, oldY: f32, oldWidth: f32, oldHeight: f32,
    newX: f32, newY: f32, newWidth: f32, newHeight: f32,
    objects: Map<u32, CanvasObject>
  ) {
    super();
    this.objectId = objectId;
    this.oldX = oldX;
    this.oldY = oldY;
    this.oldWidth = oldWidth;
    this.oldHeight = oldHeight;
    this.newX = newX;
    this.newY = newY;
    this.newWidth = newWidth;
    this.newHeight = newHeight;
    this.objects = objects;
  }
  
  execute(): void {
    const obj = this.objects.get(this.objectId);
    if (obj) {
      obj.x = this.newX;
      obj.y = this.newY;
      obj.width = this.newWidth;
      obj.height = this.newHeight;
    }
  }
  
  undo(): void {
    const obj = this.objects.get(this.objectId);
    if (obj) {
      obj.x = this.oldX;
      obj.y = this.oldY;
      obj.width = this.oldWidth;
      obj.height = this.oldHeight;
    }
  }
}

// Add a single object
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

// Delete a single object
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

// Delete multiple objects - single history entry
export class BatchDeleteCommand extends Command {
  deletedObjects: Array<CanvasObject>;
  objects: Map<u32, CanvasObject>;
  quadtree: Quadtree;
  
  constructor(
    objectIds: StaticArray<u32>,
    objects: Map<u32, CanvasObject>,
    quadtree: Quadtree
  ) {
    super();
    this.objects = objects;
    this.quadtree = quadtree;
    this.deletedObjects = new Array<CanvasObject>();
    
    // Store copies of objects to be deleted
    for (let i = 0; i < objectIds.length; i++) {
      const obj = objects.get(objectIds[i]);
      if (obj) {
        this.deletedObjects.push(obj);
      }
    }
  }
  
  execute(): void {
    for (let i = 0; i < this.deletedObjects.length; i++) {
      const obj = this.deletedObjects[i];
      this.objects.delete(obj.id);
      this.quadtree.remove(obj.id);
    }
  }
  
  undo(): void {
    for (let i = 0; i < this.deletedObjects.length; i++) {
      const obj = this.deletedObjects[i];
      this.objects.set(obj.id, obj);
      this.quadtree.insert(obj);
    }
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
    // Clear any redo history
    while (this.history.length > this.currentIndex + 1) {
      this.history.pop();
    }
    
    command.execute();
    this.history.push(command);
    this.currentIndex++;
    
    // Limit history size
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
  
  clear(): void {
    this.history = new Array<Command>();
    this.currentIndex = -1;
  }
}
