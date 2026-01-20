// Image loading Web Worker - caches compressed blobs and decodes on-demand
// Memory efficient: stores ~100KB blobs instead of ~8MB ImageBitmaps
// Also extracts dominant color for sorting

interface LoadMessage {
  type: 'load';
  id: string;
  src: string;
}

interface DecodeMessage {
  type: 'decode';
  id: string;
  maxDim: number; // Target max dimension for this decode
}

type WorkerMessage = LoadMessage | DecodeMessage;

// Blob cache - stores compressed image data (~50-200KB each)
const blobCache = new Map<string, Blob>();
const loadingSet = new Set<string>();

// Extract average RGB from an ImageBitmap by sampling pixels
async function extractAverageColor(bitmap: ImageBitmap): Promise<{ r: number; g: number; b: number }> {
  // Use a small canvas for sampling (faster than full resolution)
  const sampleSize = 50;
  const canvas = new OffscreenCanvas(sampleSize, sampleSize);
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    return { r: 128, g: 128, b: 128 }; // Fallback to gray
  }
  
  // Draw scaled down image
  ctx.drawImage(bitmap, 0, 0, sampleSize, sampleSize);
  
  // Get pixel data
  const imageData = ctx.getImageData(0, 0, sampleSize, sampleSize);
  const data = imageData.data;
  
  let totalR = 0, totalG = 0, totalB = 0;
  const pixelCount = sampleSize * sampleSize;
  
  // Sum all RGB values
  for (let i = 0; i < data.length; i += 4) {
    totalR += data[i];     // R
    totalG += data[i + 1]; // G
    totalB += data[i + 2]; // B
    // data[i + 3] is alpha, skip
  }
  
  // Calculate averages
  return {
    r: Math.round(totalR / pixelCount),
    g: Math.round(totalG / pixelCount),
    b: Math.round(totalB / pixelCount),
  };
}

// Generate a scaled ImageBitmap from a blob
async function decodeAndScale(blob: Blob, maxDim: number): Promise<ImageBitmap> {
  // First decode to full ImageBitmap
  const fullBitmap = await createImageBitmap(blob);
  
  // If no scaling needed or maxDim is Infinity, return full
  if (maxDim === Infinity || maxDim <= 0) {
    return fullBitmap;
  }
  
  const { width, height } = fullBitmap;
  const scale = Math.min(maxDim / width, maxDim / height, 1);
  
  // If scale is 1, no need to resize
  if (scale >= 1) {
    return fullBitmap;
  }
  
  const newWidth = Math.round(width * scale);
  const newHeight = Math.round(height * scale);
  
  // Create scaled version using OffscreenCanvas
  const canvas = new OffscreenCanvas(newWidth, newHeight);
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    return fullBitmap; // Fallback to full if context fails
  }
  
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(fullBitmap, 0, 0, newWidth, newHeight);
  
  // Close the full bitmap to free memory in the worker
  fullBitmap.close();
  
  return canvas.transferToImageBitmap();
}

// Handle incoming messages
self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const { type, id } = e.data;

  if (type === 'load') {
    const { src } = e.data as LoadMessage;
    
    // Skip if already cached or loading
    if (blobCache.has(id) || loadingSet.has(id)) {
      // If already cached, notify main thread it's ready
      if (blobCache.has(id)) {
        (self as unknown as Worker).postMessage({ type: 'cached', id });
      }
      return;
    }
    
    loadingSet.add(id);
    
    try {
      // Fetch and store the compressed blob (small memory footprint)
      const response = await fetch(src);
      const blob = await response.blob();
      
      // Store in cache
      blobCache.set(id, blob);
      loadingSet.delete(id);
      
      // Extract average color for sorting (decode temporarily for color extraction)
      let color = { r: 128, g: 128, b: 128 }; // Default gray
      try {
        const tempBitmap = await createImageBitmap(blob);
        color = await extractAverageColor(tempBitmap);
        tempBitmap.close(); // Free memory
      } catch {
        // Color extraction failed, use default
      }
      
      // Notify main thread that blob is cached with color info
      (self as unknown as Worker).postMessage({ 
        type: 'cached', 
        id,
        color, // Include extracted color
      });
    } catch (error) {
      loadingSet.delete(id);
      (self as unknown as Worker).postMessage({ type: 'error', id, error: String(error) });
    }
  } 
  else if (type === 'decode') {
    const { maxDim } = e.data as DecodeMessage;
    
    const blob = blobCache.get(id);
    if (!blob) {
      (self as unknown as Worker).postMessage({ type: 'error', id, error: 'Blob not cached' });
      return;
    }
    
    try {
      // Decode blob to ImageBitmap at requested size
      const bitmap = await decodeAndScale(blob, maxDim);
      
      // Transfer bitmap to main thread with requested resolution info
      (self as unknown as Worker).postMessage(
        { 
          type: 'decoded', 
          id, 
          bitmap,
          width: bitmap.width,
          height: bitmap.height,
          requestedMaxDim: maxDim, // Include what was requested for LOD tracking
        }, 
        [bitmap]
      );
    } catch (error) {
      (self as unknown as Worker).postMessage({ type: 'error', id, error: String(error) });
    }
  }
};

export { };

