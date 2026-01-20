/**
 * Create a worker from inline code (works in published packages)
 * This converts the worker code to a blob URL at runtime
 */

// Inline the grid worker code
const gridWorkerCode = `
// Grid rendering Web Worker
self.onmessage = (e) => {
  const { type, width, height, gridSize, stageX, stageY, scale } = e.data;
  
  if (type === 'render') {
    const offscreenCanvas = new OffscreenCanvas(width, height);
    const ctx = offscreenCanvas.getContext('2d');
    
    if (!ctx) {
      self.postMessage({ type: 'error', error: 'Failed to get context' });
      return;
    }
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Adjust grid size based on zoom for visual display
    let adjustedGridSize = gridSize;
    const screenGridSize = gridSize * scale;
    
    if (screenGridSize < 10) {
      while (adjustedGridSize * scale < 10) adjustedGridSize *= 2;
    } else if (screenGridSize > 200) {
      while (adjustedGridSize * scale > 200) adjustedGridSize /= 2;
    }
    
    // Limit the number of dots to prevent performance issues when zoomed out
    if (adjustedGridSize * scale < 3) {
      const bitmap = offscreenCanvas.transferToImageBitmap();
      self.postMessage({ type: 'rendered', bitmap }, [bitmap]);
      return;
    }
    
    // Calculate world coordinates of visible area
    const worldLeft = -stageX / scale;
    const worldTop = -stageY / scale;
    const worldRight = worldLeft + width / scale;
    const worldBottom = worldTop + height / scale;
    
    // Find grid lines that are visible
    const startX = Math.floor(worldLeft / adjustedGridSize) * adjustedGridSize;
    const startY = Math.floor(worldTop / adjustedGridSize) * adjustedGridSize;
    
    // Draw dots
    ctx.fillStyle = 'oklch(0.35 0.05 255)';
    
    for (let x = startX; x <= worldRight; x += adjustedGridSize) {
      for (let y = startY; y <= worldBottom; y += adjustedGridSize) {
        const screenX = (x - worldLeft) * scale;
        const screenY = (y - worldTop) * scale;
        
        if (screenX >= 0 && screenX <= width && screenY >= 0 && screenY <= height) {
          ctx.beginPath();
          ctx.arc(screenX, screenY, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    
    const bitmap = offscreenCanvas.transferToImageBitmap();
    self.postMessage({ type: 'rendered', bitmap }, [bitmap]);
  }
};
`;

// Inline the image loader worker code
const imageLoaderWorkerCode = `
const blobCache = new Map();
const loadingSet = new Set();

async function extractAverageColor(bitmap) {
  const sampleSize = 50;
  const canvas = new OffscreenCanvas(sampleSize, sampleSize);
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    return { r: 128, g: 128, b: 128 };
  }
  
  ctx.drawImage(bitmap, 0, 0, sampleSize, sampleSize);
  const imageData = ctx.getImageData(0, 0, sampleSize, sampleSize);
  const data = imageData.data;
  
  let totalR = 0, totalG = 0, totalB = 0;
  const pixelCount = sampleSize * sampleSize;
  
  for (let i = 0; i < data.length; i += 4) {
    totalR += data[i];
    totalG += data[i + 1];
    totalB += data[i + 2];
  }
  
  return {
    r: Math.round(totalR / pixelCount),
    g: Math.round(totalG / pixelCount),
    b: Math.round(totalB / pixelCount),
  };
}

async function decodeAndScale(blob, maxDim) {
  const fullBitmap = await createImageBitmap(blob);
  
  if (maxDim === Infinity || maxDim <= 0) {
    return fullBitmap;
  }
  
  const { width, height } = fullBitmap;
  const scale = Math.min(maxDim / width, maxDim / height, 1);
  
  if (scale >= 1) {
    return fullBitmap;
  }
  
  const newWidth = Math.round(width * scale);
  const newHeight = Math.round(height * scale);
  
  const canvas = new OffscreenCanvas(newWidth, newHeight);
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    return fullBitmap;
  }
  
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(fullBitmap, 0, 0, newWidth, newHeight);
  
  fullBitmap.close();
  
  return canvas.transferToImageBitmap();
}

self.onmessage = async (e) => {
  const { type, id } = e.data;

  if (type === 'load') {
    const { src } = e.data;
    
    if (blobCache.has(id) || loadingSet.has(id)) {
      if (blobCache.has(id)) {
        self.postMessage({ type: 'cached', id });
      }
      return;
    }
    
    loadingSet.add(id);
    
    try {
      const response = await fetch(src);
      const blob = await response.blob();
      
      blobCache.set(id, blob);
      loadingSet.delete(id);
      
      let color = { r: 128, g: 128, b: 128 };
      try {
        const tempBitmap = await createImageBitmap(blob);
        color = await extractAverageColor(tempBitmap);
        tempBitmap.close();
      } catch {
        // Color extraction failed, use default
      }
      
      self.postMessage({ 
        type: 'cached', 
        id,
        color,
      });
    } catch (error) {
      loadingSet.delete(id);
      self.postMessage({ type: 'error', id, error: String(error) });
    }
  } 
  else if (type === 'decode') {
    const { maxDim } = e.data;
    
    const blob = blobCache.get(id);
    if (!blob) {
      self.postMessage({ type: 'error', id, error: 'Blob not cached' });
      return;
    }
    
    try {
      const bitmap = await decodeAndScale(blob, maxDim);
      
      self.postMessage(
        { 
          type: 'decoded', 
          id, 
          bitmap,
          width: bitmap.width,
          height: bitmap.height,
          requestedMaxDim: maxDim,
        }, 
        [bitmap]
      );
    } catch (error) {
      self.postMessage({ type: 'error', id, error: String(error) });
    }
  }
};
`;

/**
 * Create a worker from inline code string
 */
function createWorkerFromCode(code: string): Worker {
  const blob = new Blob([code], { type: 'application/javascript' })
  const url = URL.createObjectURL(blob)
  return new Worker(url, { type: 'module' })
}

/**
 * Create the grid rendering worker
 */
export function createGridWorker(): Worker {
  return createWorkerFromCode(gridWorkerCode)
}

/**
 * Create the image loading worker
 */
export function createImageLoaderWorker(): Worker {
  return createWorkerFromCode(imageLoaderWorkerCode)
}
