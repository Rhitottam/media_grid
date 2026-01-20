/**
 * Helper functions for interacting with the CloudGrid canvas
 */

/**
 * Programmatically select items by their IDs
 * @param ids - Array of item IDs to select (e.g., ['img-1', 'img-2'])
 */
export function selectItems(ids: string[]): void {
  window.dispatchEvent(new CustomEvent('select-items', { detail: { ids } }));
}

/**
 * Animate camera to zoom to the currently selected items
 */
export function zoomToSelected(): void {
  window.dispatchEvent(new CustomEvent('zoom-to-selected'));
}

/**
 * Animate camera to fit specific bounds
 * @param bounds - The bounds to zoom to
 * @param _padding - Optional padding around bounds in pixels (default: 100) - Reserved for future use
 * @param _duration - Optional animation duration in ms (default: 500) - Reserved for future use
 */
export function zoomToBounds(
  bounds: { x: number; y: number; width: number; height: number },
  _padding?: number,
  _duration?: number
): void {
  window.dispatchEvent(new CustomEvent('zoom-to-bounds', { detail: bounds }));
}

/**
 * Trigger the add media dialog
 */
export function addMedia(): void {
  window.dispatchEvent(new CustomEvent('add-media'));
}

/**
 * Delete currently selected items
 */
export function deleteSelected(): void {
  window.dispatchEvent(new CustomEvent('delete-selected'));
}

/**
 * Trigger color sort of all items
 */
export function sortByColor(): void {
  window.dispatchEvent(new CustomEvent('sort-by-color'));
}
