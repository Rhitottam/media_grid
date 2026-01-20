import { Vec } from './Vec'

/**
 * A 2D axis-aligned bounding box
 */
export class Box {
  constructor(
    public x: number = 0,
    public y: number = 0,
    public width: number = 0,
    public height: number = 0
  ) {}

  // ==================== STATIC CONSTRUCTORS ====================

  static from(rect: { x: number; y: number; width: number; height: number }): Box {
    return new Box(rect.x, rect.y, rect.width, rect.height)
  }

  static fromPoints(p1: Vec, p2: Vec): Box {
    const minX = Math.min(p1.x, p2.x)
    const minY = Math.min(p1.y, p2.y)
    const maxX = Math.max(p1.x, p2.x)
    const maxY = Math.max(p1.y, p2.y)
    return new Box(minX, minY, maxX - minX, maxY - minY)
  }

  static fromCenter(center: Vec, width: number, height: number): Box {
    return new Box(center.x - width / 2, center.y - height / 2, width, height)
  }

  static zero(): Box {
    return new Box(0, 0, 0, 0)
  }

  static union(boxes: Box[]): Box {
    if (boxes.length === 0) return Box.zero()
    
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    for (const box of boxes) {
      minX = Math.min(minX, box.x)
      minY = Math.min(minY, box.y)
      maxX = Math.max(maxX, box.x + box.width)
      maxY = Math.max(maxY, box.y + box.height)
    }

    return new Box(minX, minY, maxX - minX, maxY - minY)
  }

  // ==================== BASIC OPERATIONS ====================

  clone(): Box {
    return new Box(this.x, this.y, this.width, this.height)
  }

  set(x: number, y: number, width: number, height: number): this {
    this.x = x
    this.y = y
    this.width = width
    this.height = height
    return this
  }

  copy(box: Box): this {
    this.x = box.x
    this.y = box.y
    this.width = box.width
    this.height = box.height
    return this
  }

  toObject(): { x: number; y: number; width: number; height: number } {
    return { x: this.x, y: this.y, width: this.width, height: this.height }
  }

  equals(box: Box, epsilon: number = 0.0001): boolean {
    return (
      Math.abs(this.x - box.x) < epsilon &&
      Math.abs(this.y - box.y) < epsilon &&
      Math.abs(this.width - box.width) < epsilon &&
      Math.abs(this.height - box.height) < epsilon
    )
  }

  // ==================== COMPUTED PROPERTIES ====================

  get minX(): number {
    return this.x
  }

  get minY(): number {
    return this.y
  }

  get maxX(): number {
    return this.x + this.width
  }

  get maxY(): number {
    return this.y + this.height
  }

  get centerX(): number {
    return this.x + this.width / 2
  }

  get centerY(): number {
    return this.y + this.height / 2
  }

  get center(): Vec {
    return new Vec(this.centerX, this.centerY)
  }

  get topLeft(): Vec {
    return new Vec(this.x, this.y)
  }

  get topRight(): Vec {
    return new Vec(this.maxX, this.y)
  }

  get bottomLeft(): Vec {
    return new Vec(this.x, this.maxY)
  }

  get bottomRight(): Vec {
    return new Vec(this.maxX, this.maxY)
  }

  get area(): number {
    return this.width * this.height
  }

  get perimeter(): number {
    return 2 * (this.width + this.height)
  }

  get aspectRatio(): number {
    return this.height === 0 ? 0 : this.width / this.height
  }

  // ==================== CONTAINMENT & INTERSECTION ====================

  containsPoint(point: Vec): boolean {
    return (
      point.x >= this.x &&
      point.x <= this.maxX &&
      point.y >= this.y &&
      point.y <= this.maxY
    )
  }

  containsBox(box: Box): boolean {
    return (
      box.x >= this.x &&
      box.maxX <= this.maxX &&
      box.y >= this.y &&
      box.maxY <= this.maxY
    )
  }

  intersects(box: Box): boolean {
    return !(
      box.x > this.maxX ||
      box.maxX < this.x ||
      box.y > this.maxY ||
      box.maxY < this.y
    )
  }

  intersection(box: Box): Box | null {
    if (!this.intersects(box)) return null

    const x = Math.max(this.x, box.x)
    const y = Math.max(this.y, box.y)
    const maxX = Math.min(this.maxX, box.maxX)
    const maxY = Math.min(this.maxY, box.maxY)

    return new Box(x, y, maxX - x, maxY - y)
  }

  union(box: Box): Box {
    const minX = Math.min(this.x, box.x)
    const minY = Math.min(this.y, box.y)
    const maxX = Math.max(this.maxX, box.maxX)
    const maxY = Math.max(this.maxY, box.maxY)

    return new Box(minX, minY, maxX - minX, maxY - minY)
  }

  // ==================== TRANSFORMATIONS ====================

  translate(dx: number, dy: number): Box {
    return new Box(this.x + dx, this.y + dy, this.width, this.height)
  }

  translateVec(v: Vec): Box {
    return this.translate(v.x, v.y)
  }

  scale(sx: number, sy: number = sx): Box {
    return new Box(this.x * sx, this.y * sy, this.width * sx, this.height * sy)
  }

  scaleFromCenter(sx: number, sy: number = sx): Box {
    const center = this.center
    const newWidth = this.width * sx
    const newHeight = this.height * sy
    return new Box(center.x - newWidth / 2, center.y - newHeight / 2, newWidth, newHeight)
  }

  expand(amount: number): Box {
    return new Box(
      this.x - amount,
      this.y - amount,
      this.width + amount * 2,
      this.height + amount * 2
    )
  }

  expandX(amount: number): Box {
    return new Box(this.x - amount, this.y, this.width + amount * 2, this.height)
  }

  expandY(amount: number): Box {
    return new Box(this.x, this.y - amount, this.width, this.height + amount * 2)
  }

  // ==================== UTILITY ====================

  snapToGrid(gridSize: number): Box {
    const x = Math.round(this.x / gridSize) * gridSize
    const y = Math.round(this.y / gridSize) * gridSize
    const width = Math.round(this.width / gridSize) * gridSize
    const height = Math.round(this.height / gridSize) * gridSize
    return new Box(x, y, width, height)
  }

  clamp(bounds: Box): Box {
    let x = Math.max(bounds.x, this.x)
    let y = Math.max(bounds.y, this.y)
    const maxX = Math.min(bounds.maxX, this.maxX)
    const maxY = Math.min(bounds.maxY, this.maxY)

    return new Box(x, y, Math.max(0, maxX - x), Math.max(0, maxY - y))
  }

  toString(): string {
    return `Box(${this.x}, ${this.y}, ${this.width}, ${this.height})`
  }
}
