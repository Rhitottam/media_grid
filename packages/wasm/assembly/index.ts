// Export all canvas functions
export {
  // Canvas lifecycle
  createCanvas,
  clearCanvas,
  
  // Object management
  addObject,
  moveObject,
  resizeObject,
  deleteObject,
  deleteObjects,
  
  // Batch operations (for group move/resize as single history entry)
  beginBatchMove,
  addToBatchMove,
  endBatchMove,
  beginBatchResize,
  addToBatchResize,
  endBatchResize,
  
  // Object queries
  getObjectCount,
  getObjectIdAtIndex,
  getObjectX,
  getObjectY,
  getObjectWidth,
  getObjectHeight,
  getObjectAssetId,
  getObjectType,
  objectExists,
  
  // Camera & viewport
  pan,
  zoom,
  updateViewport,
  getVisibleCount,
  getVisibleObjectId,
  getVisibleObjectAssetId,
  getVisibleObjectType,
  getTransformX,
  getTransformY,
  getTransformWidth,
  getTransformHeight,
  getTransformRotation,
  
  // History
  undo,
  redo,
  canUndo,
  canRedo,
  
  // Grid
  setGridSnap,
  setGridSize,
  getGridSize,
  
  // State
  getStateVersion,
  getCameraX,
  getCameraY,
  getCameraZoom,
  getCanvasWidth,
  getCanvasHeight,
  updateCanvasSize
} from './canvas-manager';
