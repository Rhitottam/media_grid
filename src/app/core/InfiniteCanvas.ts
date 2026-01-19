import type { WASMExports } from '../types/wasm';
import { AssetManager } from './AssetManager';
import { InputHandler } from './InputHandler';
import { Renderer } from './Renderer';

export class InfiniteCanvasApp {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private wasm!: WASMExports;
  private assetManager: AssetManager;
  private inputHandler!: InputHandler;
  private renderer!: Renderer;
  private animationId = 0;
  private totalObjects = 0;
  private lastWidth = 0;
  private lastHeight = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get 2D context');
    this.ctx = ctx;

    this.assetManager = new AssetManager();
    
    // Simple window resize handler with debounce
    let resizeTimeout: number;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = window.setTimeout(() => {
        this.updateCanvasSize();
      }, 16); // ~60fps debounce
    };
    
    window.addEventListener('resize', handleResize);
    
    // Initial size update
    this.updateCanvasSize();
  }

  private updateCanvasSize(): void {
    // Get the canvas's DISPLAY size (set by CSS 100% width/height)
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.floor(rect.width);
    const height = Math.floor(rect.height);
    
    // Skip if dimensions haven't changed or are invalid
    if (width <= 0 || height <= 0) return;
    if (width === this.lastWidth && height === this.lastHeight) return;
    
    console.log('Canvas size:', width, 'x', height);
    
    this.lastWidth = width;
    this.lastHeight = height;
    
    const dpr = window.devicePixelRatio || 1;
    
    // Only set buffer size - CSS handles display size
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    
    // Apply DPR scaling
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    
    // Update WASM if initialized
    if (this.wasm) {
      this.wasm.updateCanvasSize(width, height);
    }
  }

  async init(wasm: WASMExports): Promise<void> {
    this.wasm = wasm;
    
    // Ensure canvas is sized
    this.updateCanvasSize();
    
    // Create WASM canvas with current dimensions
    this.wasm.createCanvas(this.lastWidth || 800, this.lastHeight || 600, 20);

    this.inputHandler = new InputHandler(
      this.canvas,
      this.wasm,
      () => this.updateStats()
    );

    this.renderer = new Renderer(this.ctx, this.wasm, this.assetManager);

    this.startRenderLoop();
  }

  async addImage(url: string, x: number, y: number, width: number, height: number): Promise<number> {
    const assetId = await this.assetManager.loadImage(url);
    const objectId = this.wasm.addObject(x, y, width, height, assetId, 0);
    this.totalObjects++;
    this.updateStats();
    return objectId;
  }

  private startRenderLoop(): void {
    const render = (time: number) => {
      this.renderer.render(time);
      this.updateStats();
      this.animationId = requestAnimationFrame(render);
    };
    this.animationId = requestAnimationFrame(render);
  }

  private updateStats(): void {
    this.wasm.updateViewport();
    const visibleCount = this.wasm.getVisibleCount();
    
    const visibleEl = document.getElementById('visibleCount');
    const totalEl = document.getElementById('totalCount');
    const fpsEl = document.getElementById('fps');

    if (visibleEl) visibleEl.textContent = visibleCount.toString();
    if (totalEl) totalEl.textContent = this.totalObjects.toString();
    if (fpsEl) fpsEl.textContent = this.renderer.getFPS().toString();
  }

  setGridSnap(enabled: boolean): void {
    this.wasm.setGridSnap(enabled);
  }

  setGridSize(size: number): void {
    this.wasm.setGridSize(size);
  }

  destroy(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    this.inputHandler.destroy();
  }
}
