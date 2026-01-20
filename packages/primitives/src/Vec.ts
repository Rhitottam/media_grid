/**
 * A 2D vector class for geometric calculations
 */
export class Vec {
  constructor(
    public x: number = 0,
    public y: number = 0
  ) {}

  // ==================== STATIC CONSTRUCTORS ====================

  static from(point: { x: number; y: number }): Vec {
    return new Vec(point.x, point.y)
  }

  static fromArray(arr: [number, number]): Vec {
    return new Vec(arr[0], arr[1])
  }

  static zero(): Vec {
    return new Vec(0, 0)
  }

  // ==================== BASIC OPERATIONS ====================

  clone(): Vec {
    return new Vec(this.x, this.y)
  }

  set(x: number, y: number): this {
    this.x = x
    this.y = y
    return this
  }

  copy(v: Vec): this {
    this.x = v.x
    this.y = v.y
    return this
  }

  toArray(): [number, number] {
    return [this.x, this.y]
  }

  toObject(): { x: number; y: number } {
    return { x: this.x, y: this.y }
  }

  equals(v: Vec, epsilon: number = 0.0001): boolean {
    return Math.abs(this.x - v.x) < epsilon && Math.abs(this.y - v.y) < epsilon
  }

  // ==================== ARITHMETIC ====================

  add(v: Vec): Vec {
    return new Vec(this.x + v.x, this.y + v.y)
  }

  addScalar(n: number): Vec {
    return new Vec(this.x + n, this.y + n)
  }

  sub(v: Vec): Vec {
    return new Vec(this.x - v.x, this.y - v.y)
  }

  subScalar(n: number): Vec {
    return new Vec(this.x - n, this.y - n)
  }

  mul(v: Vec): Vec {
    return new Vec(this.x * v.x, this.y * v.y)
  }

  mulScalar(n: number): Vec {
    return new Vec(this.x * n, this.y * n)
  }

  div(v: Vec): Vec {
    return new Vec(this.x / v.x, this.y / v.y)
  }

  divScalar(n: number): Vec {
    return new Vec(this.x / n, this.y / n)
  }

  negate(): Vec {
    return new Vec(-this.x, -this.y)
  }

  // ==================== GEOMETRY ====================

  length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y)
  }

  lengthSquared(): number {
    return this.x * this.x + this.y * this.y
  }

  normalize(): Vec {
    const len = this.length()
    if (len === 0) return new Vec(0, 0)
    return new Vec(this.x / len, this.y / len)
  }

  dot(v: Vec): number {
    return this.x * v.x + this.y * v.y
  }

  cross(v: Vec): number {
    return this.x * v.y - this.y * v.x
  }

  distance(v: Vec): number {
    return this.sub(v).length()
  }

  distanceSquared(v: Vec): number {
    return this.sub(v).lengthSquared()
  }

  angle(): number {
    return Math.atan2(this.y, this.x)
  }

  angleTo(v: Vec): number {
    return Math.atan2(v.y - this.y, v.x - this.x)
  }

  rotate(angle: number): Vec {
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    return new Vec(this.x * cos - this.y * sin, this.x * sin + this.y * cos)
  }

  rotateAround(center: Vec, angle: number): Vec {
    return this.sub(center).rotate(angle).add(center)
  }

  lerp(v: Vec, t: number): Vec {
    return new Vec(this.x + (v.x - this.x) * t, this.y + (v.y - this.y) * t)
  }

  // ==================== UTILITY ====================

  abs(): Vec {
    return new Vec(Math.abs(this.x), Math.abs(this.y))
  }

  floor(): Vec {
    return new Vec(Math.floor(this.x), Math.floor(this.y))
  }

  ceil(): Vec {
    return new Vec(Math.ceil(this.x), Math.ceil(this.y))
  }

  round(): Vec {
    return new Vec(Math.round(this.x), Math.round(this.y))
  }

  min(v: Vec): Vec {
    return new Vec(Math.min(this.x, v.x), Math.min(this.y, v.y))
  }

  max(v: Vec): Vec {
    return new Vec(Math.max(this.x, v.x), Math.max(this.y, v.y))
  }

  clamp(min: Vec, max: Vec): Vec {
    return new Vec(
      Math.max(min.x, Math.min(max.x, this.x)),
      Math.max(min.y, Math.min(max.y, this.y))
    )
  }

  snapToGrid(gridSize: number): Vec {
    return new Vec(
      Math.round(this.x / gridSize) * gridSize,
      Math.round(this.y / gridSize) * gridSize
    )
  }

  toString(): string {
    return `Vec(${this.x}, ${this.y})`
  }
}
