import { Box, Vec, snapToGrid } from '@convadraw/primitives'
import {
    Store,
    type CanvasItem,
    type CanvasSnapshot,
    type CreateItem,
    type GridSettings,
    type StoreEventType,
    type ToolType,
    type Viewport,
} from '@convadraw/state'

export interface EditorOptions {
  initialItems?: CreateItem[]
  gridSize?: number
  snapToGrid?: boolean
  showGrid?: boolean
  minZoom?: number
  maxZoom?: number
}

/**
 * CloudGrid Editor - the main entry point for canvas operations
 * 
 * This class provides a high-level API for managing the infinite canvas,
 * including items, selection, viewport, history, and tools.
 */
export class Editor {
  readonly store: Store
  private minZoom: number
  private maxZoom: number
  private disposed: boolean = false

  constructor(options: EditorOptions = {}) {
    this.store = new Store({
      gridSettings: {
        gridSize: options.gridSize ?? 25,
        snapToGrid: options.snapToGrid ?? true,
        showGrid: options.showGrid ?? true,
      },
    })

    this.minZoom = options.minZoom ?? 0.1
    this.maxZoom = options.maxZoom ?? 10

    // Add initial items
    if (options.initialItems) {
      options.initialItems.forEach((item) => this.addItem(item))
      this.store.clearHistory() // Don't pollute history with initial items
    }
  }

  // ==================== STATE ACCESS ====================

  /**
   * Get all items on the canvas
   */
  getItems(): CanvasItem[] {
    return this.store.getItems()
  }

  /**
   * Get a specific item by ID
   */
  getItem(id: string): CanvasItem | undefined {
    return this.store.getItem(id)
  }

  /**
   * Get currently selected items
   */
  getSelectedItems(): CanvasItem[] {
    return this.store.getSelectedItems()
  }

  /**
   * Get IDs of currently selected items
   */
  getSelectedIds(): string[] {
    return this.store.getSelectedIds()
  }

  /**
   * Get current viewport (position and zoom)
   */
  getViewport(): Viewport {
    return this.store.getViewport()
  }

  /**
   * Get current active tool
   */
  getCurrentTool(): ToolType {
    return this.store.getCurrentTool()
  }

  /**
   * Get grid settings
   */
  getGridSettings(): GridSettings {
    return this.store.getGridSettings()
  }

  /**
   * Get full canvas snapshot for serialization
   */
  getSnapshot(): CanvasSnapshot {
    return this.store.getSnapshot()
  }

  // ==================== TOOLS ====================

  /**
   * Set the current active tool
   */
  setCurrentTool(tool: ToolType): this {
    this.store.setCurrentTool(tool)
    return this
  }

  // ==================== HISTORY ====================

  /**
   * Undo the last operation
   */
  undo(): this {
    this.store.undo()
    return this
  }

  /**
   * Redo the last undone operation
   */
  redo(): this {
    this.store.redo()
    return this
  }

  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    return this.store.canUndo()
  }

  /**
   * Check if redo is available
   */
  canRedo(): boolean {
    return this.store.canRedo()
  }

  /**
   * Clear all history
   */
  clearHistory(): this {
    this.store.clearHistory()
    return this
  }

  // ==================== ITEM OPERATIONS ====================

  /**
   * Add a new item to the canvas
   */
  addItem(item: CreateItem): string {
    const gridSize = this.store.getGridSettings().gridSize
    const shouldSnap = this.store.getGridSettings().snapToGrid

    // Snap position to grid if enabled
    const x = shouldSnap ? snapToGrid(item.x, gridSize) : item.x
    const y = shouldSnap ? snapToGrid(item.y, gridSize) : item.y

    return this.store.addItem({ ...item, x, y })
  }

  /**
   * Remove an item from the canvas
   */
  removeItem(id: string): this {
    this.store.removeItem(id)
    return this
  }

  /**
   * Remove multiple items from the canvas (single undo entry)
   */
  removeItems(ids: string[]): this {
    this.store.removeItems(ids)
    return this
  }

  /**
   * Remove currently selected items
   */
  deleteSelected(): this {
    const selectedIds = this.getSelectedIds()
    if (selectedIds.length > 0) {
      this.store.removeItems(selectedIds)
    }
    return this
  }

  /**
   * Move an item to a new position
   */
  moveItem(id: string, position: { x: number; y: number }): this {
    const gridSize = this.store.getGridSettings().gridSize
    const shouldSnap = this.store.getGridSettings().snapToGrid

    const x = shouldSnap ? snapToGrid(position.x, gridSize) : position.x
    const y = shouldSnap ? snapToGrid(position.y, gridSize) : position.y

    this.store.moveItem(id, x, y)
    return this
  }

  /**
   * Move multiple items by a delta (single undo entry)
   */
  moveItems(ids: string[], delta: { dx: number; dy: number }): this {
    const gridSize = this.store.getGridSettings().gridSize
    const shouldSnap = this.store.getGridSettings().snapToGrid

    const dx = shouldSnap ? snapToGrid(delta.dx, gridSize) : delta.dx
    const dy = shouldSnap ? snapToGrid(delta.dy, gridSize) : delta.dy

    this.store.moveItems(ids, dx, dy)
    return this
  }

  /**
   * Resize an item
   */
  resizeItem(id: string, size: { width: number; height: number }): this {
    const gridSize = this.store.getGridSettings().gridSize
    const shouldSnap = this.store.getGridSettings().snapToGrid

    const width = shouldSnap ? snapToGrid(size.width, gridSize) : size.width
    const height = shouldSnap ? snapToGrid(size.height, gridSize) : size.height

    this.store.resizeItem(id, width, height)
    return this
  }

  /**
   * Resize multiple items by a scale factor (single undo entry)
   */
  resizeItems(ids: string[], scale: number): this {
    this.store.resizeItems(ids, scale)
    return this
  }

  /**
   * Update item properties
   */
  updateItem(id: string, updates: Partial<CanvasItem>): this {
    this.store.updateItem(id, updates)
    return this
  }

  // ==================== SELECTION ====================

  /**
   * Select a single item (clears previous selection)
   */
  select(id: string): this {
    this.store.select(id)
    return this
  }

  /**
   * Select multiple items
   */
  selectItems(ids: string[]): this {
    this.store.selectItems(ids)
    return this
  }

  /**
   * Select all items
   */
  selectAll(): this {
    this.store.selectAll()
    return this
  }

  /**
   * Clear selection
   */
  selectNone(): this {
    this.store.selectNone()
    return this
  }

  /**
   * Toggle item selection
   */
  toggleSelection(id: string): this {
    this.store.toggleSelection(id)
    return this
  }

  /**
   * Add item to current selection
   */
  addToSelection(id: string): this {
    this.store.addToSelection(id)
    return this
  }

  /**
   * Remove item from current selection
   */
  removeFromSelection(id: string): this {
    this.store.removeFromSelection(id)
    return this
  }

  // ==================== VIEWPORT ====================

  /**
   * Set viewport position and/or zoom
   */
  setViewport(viewport: Partial<Viewport>): this {
    if (viewport.zoom !== undefined) {
      viewport.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, viewport.zoom))
    }
    this.store.setViewport(viewport)
    return this
  }

  /**
   * Pan the viewport by a delta
   */
  pan(dx: number, dy: number): this {
    this.store.pan(dx, dy)
    return this
  }

  /**
   * Pan to a specific position
   */
  panTo(x: number, y: number): this {
    this.store.setViewport({ x, y })
    return this
  }

  /**
   * Zoom to a specific level
   */
  zoomTo(zoom: number, center?: { x: number; y: number }): this {
    const clampedZoom = Math.max(this.minZoom, Math.min(this.maxZoom, zoom))
    this.store.zoom(clampedZoom, center)
    return this
  }

  /**
   * Zoom in by a factor
   */
  zoomIn(): this {
    this.store.zoomIn()
    return this
  }

  /**
   * Zoom out by a factor
   */
  zoomOut(): this {
    this.store.zoomOut()
    return this
  }

  /**
   * Fit all items in the viewport
   */
  zoomToFit(padding: number = 50): this {
    const items = this.getItems()
    if (items.length === 0) {
      this.setViewport({ x: 0, y: 0, zoom: 1 })
      return this
    }

    const boxes = items.map((item) => new Box(item.x, item.y, item.width, item.height))
    const bounds = Box.union(boxes).expand(padding)

    // Calculate zoom to fit bounds
    // This would need container dimensions - for now just center
    this.panTo(-bounds.centerX, -bounds.centerY)
    return this
  }

  /**
   * Fit selected items in the viewport
   */
  zoomToSelection(padding: number = 50): this {
    const items = this.getSelectedItems()
    if (items.length === 0) return this

    const boxes = items.map((item) => new Box(item.x, item.y, item.width, item.height))
    const bounds = Box.union(boxes).expand(padding)

    this.panTo(-bounds.centerX, -bounds.centerY)
    return this
  }

  /**
   * Center viewport on an item
   */
  centerOn(id: string): this {
    const item = this.getItem(id)
    if (!item) return this

    const center = new Vec(item.x + item.width / 2, item.y + item.height / 2)
    this.panTo(-center.x, -center.y)
    return this
  }

  // ==================== GRID ====================

  /**
   * Set grid settings (all at once)
   */
  setGridSettings(settings: Partial<GridSettings>): this {
    this.store.setGridSettings(settings)
    return this
  }

  /**
   * Set grid size
   */
  setGridSize(size: number): this {
    this.store.setGridSettings({ gridSize: size })
    return this
  }

  /**
   * Toggle snap to grid
   */
  setSnapToGrid(enabled: boolean): this {
    this.store.setGridSettings({ snapToGrid: enabled })
    return this
  }

  /**
   * Toggle grid visibility
   */
  setShowGrid(visible: boolean): this {
    this.store.setGridSettings({ showGrid: visible })
    return this
  }

  // ==================== CLIPBOARD ====================

  private clipboard: CanvasItem[] = []

  /**
   * Copy selected items to clipboard
   */
  copy(): this {
    this.clipboard = this.getSelectedItems().map((item) => ({ ...item }))
    return this
  }

  /**
   * Cut selected items to clipboard
   */
  cut(): this {
    this.copy()
    this.deleteSelected()
    return this
  }

  /**
   * Paste items from clipboard
   */
  paste(offset: { x: number; y: number } = { x: 20, y: 20 }): this {
    if (this.clipboard.length === 0) return this

    const newIds: string[] = []
    
    this.store.batch(() => {
      this.clipboard.forEach((item) => {
        const newId = this.addItem({
          ...item,
          id: undefined, // Generate new ID
          x: item.x + offset.x,
          y: item.y + offset.y,
        } as CreateItem)
        newIds.push(newId)
      })
    })

    this.selectItems(newIds)
    return this
  }

  /**
   * Duplicate selected items
   */
  duplicate(): this {
    this.copy()
    this.paste()
    return this
  }

  // ==================== SERIALIZATION ====================

  /**
   * Export canvas as JSON
   */
  exportAsJSON(): string {
    return JSON.stringify(this.getSnapshot(), null, 2)
  }

  /**
   * Load canvas from JSON
   */
  loadFromJSON(json: string): this {
    const snapshot = JSON.parse(json) as CanvasSnapshot
    this.store.loadSnapshot(snapshot)
    return this
  }

  /**
   * Load from snapshot object
   */
  loadFromSnapshot(snapshot: CanvasSnapshot): this {
    this.store.loadSnapshot(snapshot)
    return this
  }

  // ==================== EVENTS ====================

  /**
   * Subscribe to store events
   */
  on<T = unknown>(event: StoreEventType, callback: (event: { type: StoreEventType; data: T }) => void): () => void {
    return this.store.on(event, callback)
  }

  /**
   * Unsubscribe from store events
   */
  off<T = unknown>(event: StoreEventType, callback: (event: { type: StoreEventType; data: T }) => void): void {
    this.store.off(event, callback)
  }

  // ==================== BATCH OPERATIONS ====================

  /**
   * Batch multiple operations into a single history entry
   */
  batch(fn: () => void): this {
    this.store.batch(fn)
    return this
  }

  // ==================== CLEANUP ====================

  /**
   * Clear the canvas
   */
  clear(): this {
    this.store.clear()
    return this
  }

  /**
   * Dispose the editor and clean up resources
   */
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.store.clear()
  }

  /**
   * Check if editor is disposed
   */
  isDisposed(): boolean {
    return this.disposed
  }
}
