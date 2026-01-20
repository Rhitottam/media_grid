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
