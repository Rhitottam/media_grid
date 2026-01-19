import type { WASMExports } from '../types/wasm';
import type { AssetManager } from './AssetManager';

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private wasm: WASMExports;
  private assetManager: AssetManager;
  private lastFrameTime = 0;
  private fps = 0;
  private dotColor = 'oklch(0.35 0.05 255)'; // Slightly brighter than --border
  private dotSize = 1.5;

  constructor(
    ctx: CanvasRenderingContext2D,
    wasm: WASMExports,
    assetManager: AssetManager
  ) {
    this.ctx = ctx;
    this.wasm = wasm;
    this.assetManager = assetManager;
  }

  private renderGrid(): void {
    const canvas = this.ctx.canvas;
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;
    
    const cameraX = this.wasm.getCameraX();
    const cameraY = this.wasm.getCameraY();
    const zoom = this.wasm.getCameraZoom();
    const gridSize = this.wasm.getGridSize();
    
    // Calculate the grid spacing in screen coordinates
    const screenGridSize = gridSize * zoom;
    
    // Don't render grid if it's too dense or too sparse
    if (screenGridSize < 10 || screenGridSize > 200) {
      // Adjust grid size for visibility
      let adjustedGridSize = gridSize;
      while (adjustedGridSize * zoom < 10) adjustedGridSize *= 2;
      while (adjustedGridSize * zoom > 200) adjustedGridSize /= 2;
      
      const adjustedScreenGridSize = adjustedGridSize * zoom;
      this.renderGridDots(width, height, cameraX, cameraY, zoom, adjustedScreenGridSize, adjustedGridSize);
    } else {
      this.renderGridDots(width, height, cameraX, cameraY, zoom, screenGridSize, gridSize);
    }
  }

  private renderGridDots(
    width: number,
    height: number,
    cameraX: number,
    cameraY: number,
    zoom: number,
    _screenGridSize: number,
    worldGridSize: number
  ): void {
    this.ctx.fillStyle = this.dotColor;
    
    // Calculate world coordinates of the viewport edges
    const worldLeft = cameraX - (width / 2) / zoom;
    const worldTop = cameraY - (height / 2) / zoom;
    const worldRight = cameraX + (width / 2) / zoom;
    const worldBottom = cameraY + (height / 2) / zoom;
    
    // Snap to grid
    const startX = Math.floor(worldLeft / worldGridSize) * worldGridSize;
    const startY = Math.floor(worldTop / worldGridSize) * worldGridSize;
    
    // Calculate dot size based on zoom (smaller when zoomed out)
    const dotSize = Math.max(1, Math.min(3, this.dotSize * Math.sqrt(zoom)));
    
    // Render dots
    for (let worldX = startX; worldX <= worldRight; worldX += worldGridSize) {
      for (let worldY = startY; worldY <= worldBottom; worldY += worldGridSize) {
        // Convert world to screen coordinates
        const screenX = (worldX - cameraX) * zoom + width / 2;
        const screenY = (worldY - cameraY) * zoom + height / 2;
        
        // Draw dot
        this.ctx.beginPath();
        this.ctx.arc(screenX, screenY, dotSize, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }
  }

  render(time: number): void {
    // Calculate FPS
    if (this.lastFrameTime) {
      const delta = time - this.lastFrameTime;
      this.fps = Math.round(1000 / delta);
    }
    this.lastFrameTime = time;

    // Update visible objects in WASM
    this.wasm.updateViewport();
    const visibleCount = this.wasm.getVisibleCount();

    const dpr = window.devicePixelRatio || 1;
    const width = this.ctx.canvas.width / dpr;
    const height = this.ctx.canvas.height / dpr;

    // Clear canvas with background color
    this.ctx.fillStyle = 'oklch(0.09 0.01 255)'; // --background
    this.ctx.fillRect(0, 0, width, height);

    // Render grid dots
    this.renderGrid();

    if (visibleCount === 0) return;

    // Render each visible object
    for (let i = 0; i < visibleCount; i++) {
      const assetId = this.wasm.getVisibleObjectAssetId(i);
      const asset = this.assetManager.getAsset(assetId);
      if (!asset) continue;

      const x = this.wasm.getTransformX(i);
      const y = this.wasm.getTransformY(i);
      const width = this.wasm.getTransformWidth(i);
      const height = this.wasm.getTransformHeight(i);
      const rotation = this.wasm.getTransformRotation(i);

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
