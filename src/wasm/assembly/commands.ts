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
