// Grid rendering Web Worker using OffscreenCanvas

interface GridMessage {
  type: 'render';
  width: number;
  height: number;
  gridSize: number;
  stageX: number;
  stageY: number;
  scale: number;
}

let offscreenCanvas: OffscreenCanvas | null = null;
let ctx: OffscreenCanvasRenderingContext2D | null = null;

self.onmessage = (e: MessageEvent<GridMessage>) => {
  const { type, width, height, gridSize, stageX, stageY, scale } = e.data;

  if (type === 'render') {
    // Create or resize canvas
    if (!offscreenCanvas || offscreenCanvas.width !== width || offscreenCanvas.height !== height) {
      offscreenCanvas = new OffscreenCanvas(width, height);
      ctx = offscreenCanvas.getContext('2d');
    }

    if (!ctx) return;

    // Clear
    ctx.clearRect(0, 0, width, height);

    // Calculate visible world bounds
    const worldLeft = -stageX / scale;
    const worldTop = -stageY / scale;
    const worldRight = worldLeft + width / scale;
    const worldBottom = worldTop + height / scale;

    // Dynamic visual grid spacing based on zoom level
    // This keeps dots visible and not too dense at any zoom level
    let visualGridSize = gridSize;
    const screenGridSize = gridSize * scale;
    
    // If dots would be too close together on screen, double the spacing for visualization
    if (screenGridSize < 15) {
      while (visualGridSize * scale < 15) {
        visualGridSize *= 2;
      }
    }
    // If dots would be too far apart on screen, halve the spacing for visualization
    else if (screenGridSize > 150) {
      while (visualGridSize * scale > 150) {
        visualGridSize /= 2;
      }
    }

    // Snap to visual grid
    const startX = Math.floor(worldLeft / visualGridSize) * visualGridSize;
    const startY = Math.floor(worldTop / visualGridSize) * visualGridSize;

    // Draw dots
    ctx.fillStyle = 'rgb(89, 95, 114)'; // oklch(0.35 0.05 255) approximation
    const dotScreenSize = visualGridSize * scale;
    const dotSize = Math.max(1.5, Math.min(4, dotScreenSize / 15));

    for (let worldX = startX; worldX <= worldRight; worldX += visualGridSize) {
      for (let worldY = startY; worldY <= worldBottom; worldY += visualGridSize) {
        const screenX = (worldX - worldLeft) * scale;
        const screenY = (worldY - worldTop) * scale;

        ctx.beginPath();
        ctx.arc(screenX, screenY, dotSize, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Transfer bitmap back to main thread
    const bitmap = offscreenCanvas.transferToImageBitmap();
    (self as unknown as Worker).postMessage({ type: 'rendered', bitmap }, [bitmap]);
  }
};

export {};
