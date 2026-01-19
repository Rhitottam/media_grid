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
    
    let minX: f32 = Infinity;
    let minY: f32 = Infinity;
    let maxX: f32 = -Infinity;
    let maxY: f32 = -Infinity;
    
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
  
  query(range: AABB, found: Array<CanvasObject>, seenIds: Map<u32, bool>): void {
    if (!this.boundary.intersects(range)) {
      return;
    }
    
    for (let i = 0; i < this.objects.length; i++) {
      const obj = this.objects[i];
      // Avoid duplicates - objects can exist in multiple quadrants
      if (!seenIds.has(obj.id) && range.intersects(obj.getBounds())) {
        seenIds.set(obj.id, true);
        found.push(obj);
      }
    }
    
    if (this.divided) {
      this.northeast!.query(range, found, seenIds);
      this.northwest!.query(range, found, seenIds);
      this.southeast!.query(range, found, seenIds);
      this.southwest!.query(range, found, seenIds);
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
    const seenIds = new Map<u32, bool>();
    this.root.query(viewport, found, seenIds);
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
