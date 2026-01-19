// Image loading Web Worker - caches compressed blobs and decodes on-demand
// Memory efficient: stores ~100KB blobs instead of ~8MB ImageBitmaps

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
      
      // Notify main thread that blob is cached and ready for decode
      (self as unknown as Worker).postMessage({ type: 'cached', id });
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
      
      // Transfer bitmap to main thread
      (self as unknown as Worker).postMessage(
        { 
          type: 'decoded', 
          id, 
          bitmap,
          width: bitmap.width,
          height: bitmap.height,
        }, 
        [bitmap]
      );
    } catch (error) {
      (self as unknown as Worker).postMessage({ type: 'error', id, error: String(error) });
    }
  }
};

export { };

