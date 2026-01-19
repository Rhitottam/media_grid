// Image loading Web Worker - loads images and generates multiple resolution levels (mipmaps)

interface LoadMessage {
  type: 'load';
  id: string;
  src: string;
  originalWidth: number;
  originalHeight: number;
}

// Resolution levels - we'll generate these from the full image
const RESOLUTION_LEVELS = [
  { name: 'tiny', maxDim: 50 },      // For very zoomed out
  { name: 'thumb', maxDim: 100 },    // Thumbnail
  { name: 'small', maxDim: 200 },    // Small preview
  { name: 'medium', maxDim: 400 },   // Medium quality
  { name: 'large', maxDim: 800 },    // Large
  { name: 'full', maxDim: Infinity }, // Original resolution
];

// Generate a scaled version of the image
function generateScaledBitmap(
  sourceBitmap: ImageBitmap,
  maxDim: number
): Promise<ImageBitmap> {
  const { width, height } = sourceBitmap;
  
  // Calculate scaled dimensions maintaining aspect ratio
  let newWidth = width;
  let newHeight = height;
  
  if (maxDim !== Infinity) {
    const scale = Math.min(maxDim / width, maxDim / height, 1);
    newWidth = Math.round(width * scale);
    newHeight = Math.round(height * scale);
  }
  
  // If dimensions are the same, return original
  if (newWidth === width && newHeight === height) {
    return Promise.resolve(sourceBitmap);
  }
  
  // Create OffscreenCanvas and draw scaled image
  const canvas = new OffscreenCanvas(newWidth, newHeight);
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    return Promise.reject(new Error('Failed to get 2d context'));
  }
  
  // Use high-quality image smoothing for downscaling
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(sourceBitmap, 0, 0, newWidth, newHeight);
  
  return canvas.transferToImageBitmap() as unknown as Promise<ImageBitmap>;
}

self.onmessage = async (e: MessageEvent<LoadMessage>) => {
  const { type, id, src } = e.data;

  if (type === 'load') {
    try {
      // Fetch and decode the full-resolution image
      const response = await fetch(src);
      const blob = await response.blob();
      const fullBitmap = await createImageBitmap(blob);
      
      // Generate all resolution levels
      const levels: { [key: string]: ImageBitmap } = {};
      
      for (const level of RESOLUTION_LEVELS) {
        if (level.name === 'full') {
          levels[level.name] = fullBitmap;
        } else {
          // Generate scaled version
          const scaledBitmap = await generateScaledBitmap(fullBitmap, level.maxDim);
          levels[level.name] = scaledBitmap;
        }
      }
      
      // Transfer all bitmaps back to main thread
      const transferables = Object.values(levels);
      
      (self as unknown as Worker).postMessage(
        { 
          type: 'loaded', 
          id, 
          levels,
          originalWidth: fullBitmap.width,
          originalHeight: fullBitmap.height,
        }, 
        transferables
      );
    } catch (error) {
      (self as unknown as Worker).postMessage({ type: 'error', id, error: String(error) });
    }
  }
};

export {};
