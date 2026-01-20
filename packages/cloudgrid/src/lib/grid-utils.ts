/**
 * Snap a value to the nearest grid point
 */
export function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize;
}

/**
 * Snap a group of items by their collective top-left corner.
 * This preserves relative positioning within the group.
 * 
 * @param items - Array of items with x, y positions
 * @param gridSize - The grid size to snap to
 * @returns The offset to apply to all items
 */
export function getGroupSnapOffset(
  items: Array<{ x: number; y: number }>,
  gridSize: number
): { dx: number; dy: number } {
  if (items.length === 0) return { dx: 0, dy: 0 };

  // Find the top-left corner of the group's bounding box
  const minX = Math.min(...items.map(item => item.x));
  const minY = Math.min(...items.map(item => item.y));

  // Calculate where the top-left should snap to
  const snappedMinX = snapToGrid(minX, gridSize);
  const snappedMinY = snapToGrid(minY, gridSize);

  // Return the offset to apply to all items
  return {
    dx: snappedMinX - minX,
    dy: snappedMinY - minY,
  };
}

/**
 * Snap dimensions to grid while maintaining aspect ratio as close as possible.
 * Both width and height will be divisible by gridSize.
 * 
 * @param targetHeight - The target height (will be snapped)
 * @param originalAspectRatio - width / height of original image
 * @param gridSize - The grid size to snap to
 * @returns { width, height } both divisible by gridSize
 */
export function snapDimensionsToGrid(
  targetHeight: number,
  originalAspectRatio: number,
  gridSize: number
): { width: number; height: number } {
  // Snap height to grid
  const snappedHeight = snapToGrid(targetHeight, gridSize);
  
  // Calculate ideal width based on aspect ratio
  const targetWidth = snappedHeight * originalAspectRatio;
  
  // Try different grid-aligned widths around the target
  // Check up to 5 grid cells in each direction
  let bestWidth = snapToGrid(targetWidth, gridSize);
  let bestDiff = Math.abs(bestWidth / snappedHeight - originalAspectRatio);
  
  for (let offset = -5; offset <= 5; offset++) {
    if (offset === 0) continue; // Already checked
    const testWidth = snapToGrid(targetWidth, gridSize) + offset * gridSize;
    if (testWidth <= 0) continue; // Width must be positive
    
    const testAspectRatio = testWidth / snappedHeight;
    const diff = Math.abs(testAspectRatio - originalAspectRatio);
    
    if (diff < bestDiff) {
      bestDiff = diff;
      bestWidth = testWidth;
    }
  }
  
  return { width: bestWidth, height: snappedHeight };
}
