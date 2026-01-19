import type { WASMExports } from '../types/wasm';

export class InputHandler {
  private canvas: HTMLCanvasElement;
  private wasm: WASMExports;
  private isDragging = false;
  private dragStart = { x: 0, y: 0 };
  private onUpdate: () => void;

  constructor(canvas: HTMLCanvasElement, wasm: WASMExports, onUpdate: () => void) {
    this.canvas = canvas;
    this.wasm = wasm;
    this.onUpdate = onUpdate;
    this.setupListeners();
  }

  private setupListeners(): void {
    this.canvas.addEventListener('mousedown', this.onMouseDown);
    this.canvas.addEventListener('mousemove', this.onMouseMove);
    this.canvas.addEventListener('mouseup', this.onMouseUp);
    this.canvas.addEventListener('mouseleave', this.onMouseUp);
    this.canvas.addEventListener('wheel', this.onWheel);
    
    document.addEventListener('keydown', this.onKeyDown);
  }

  private onMouseDown = (e: MouseEvent): void => {
    this.isDragging = true;
    this.dragStart = { x: e.clientX, y: e.clientY };
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (!this.isDragging) return;

    const dx = e.clientX - this.dragStart.x;
    const dy = e.clientY - this.dragStart.y;

    this.wasm.pan(-dx, -dy);
    
    this.dragStart = { x: e.clientX, y: e.clientY };
  };

  private onMouseUp = (): void => {
    this.isDragging = false;
  };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    
    const delta = -e.deltaY * 0.001;
    this.wasm.zoom(e.clientX, e.clientY, delta);
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        this.wasm.undo();
        this.onUpdate();
      } else if (e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        this.wasm.redo();
        this.onUpdate();
      }
    }
  };

  destroy(): void {
    this.canvas.removeEventListener('mousedown', this.onMouseDown);
    this.canvas.removeEventListener('mousemove', this.onMouseMove);
    this.canvas.removeEventListener('mouseup', this.onMouseUp);
    this.canvas.removeEventListener('mouseleave', this.onMouseUp);
    this.canvas.removeEventListener('wheel', this.onWheel);
    document.removeEventListener('keydown', this.onKeyDown);
  }
}
