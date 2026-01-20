import { uniqueId } from '@convadraw/primitives'
import type {
  CanvasItem,
  CanvasSnapshot,
  CanvasState,
  CreateItem,
  GridSettings,
  HistoryEntry,
  StoreEvent,
  StoreEventType,
  ToolType,
  Viewport,
} from './types'

type Listener<T = unknown> = (event: StoreEvent<T>) => void

/**
 * Central state store for CloudGrid
 * Manages items, selection, viewport, history, and tools
 */
export class Store {
  private state: CanvasState
  private history: HistoryEntry[] = []
  private historyIndex: number = -1
  private maxHistoryLength: number = 100
  private listeners: Map<StoreEventType, Set<Listener>> = new Map()
  private batchDepth: number = 0
  private batchedEvents: StoreEvent[] = []

  constructor(initialState?: Partial<CanvasState>) {
    this.state = {
      items: new Map(),
      selectedIds: new Set(),
      viewport: { x: 0, y: 0, zoom: 1 },
      currentTool: 'select',
      gridSettings: {
        gridSize: 25,
        snapToGrid: true,
        showGrid: true,
      },
      ...initialState,
    }
  }

  // ==================== GETTERS ====================

  getItems(): CanvasItem[] {
    return Array.from(this.state.items.values())
  }

  getItem(id: string): CanvasItem | undefined {
    return this.state.items.get(id)
  }

  getSelectedIds(): string[] {
    return Array.from(this.state.selectedIds)
  }

  getSelectedItems(): CanvasItem[] {
    return this.getSelectedIds()
      .map((id) => this.state.items.get(id))
      .filter((item): item is CanvasItem => item !== undefined)
  }

  getViewport(): Viewport {
    return { ...this.state.viewport }
  }

  getCurrentTool(): ToolType {
    return this.state.currentTool
  }

  getGridSettings(): GridSettings {
    return { ...this.state.gridSettings }
  }

  // ==================== ITEM OPERATIONS ====================

  addItem(input: CreateItem): string {
    const id = input.id || uniqueId()
    const baseProps = {
      rotation: 0,
      opacity: 1,
      locked: false,
      parentId: null,
    }

    let item: CanvasItem

    switch (input.type) {
      case 'image':
        item = {
          ...baseProps,
          ...input,
          id,
          type: 'image',
        } as CanvasItem
        break
      case 'video':
        item = {
          ...baseProps,
          playing: false,
          currentTime: 0,
          ...input,
          id,
          type: 'video',
        } as CanvasItem
        break
      case 'text':
        item = {
          ...baseProps,
          width: input.width || 200,
          height: input.height || 100,
          ...input,
          id,
          type: 'text',
        } as CanvasItem
        break
      default:
        throw new Error(`Unknown item type`)
    }

    const prevItems = new Map(this.state.items)
    this.state.items.set(id, item)

    this.pushHistory({
      type: 'addItem',
      data: { id },
      undo: () => {
        this.state.items = prevItems
        this.emit('itemsChange', this.getItems())
      },
      redo: () => {
        this.state.items.set(id, item)
        this.emit('itemsChange', this.getItems())
      },
    })

    this.emit('itemsChange', this.getItems())
    return id
  }

  removeItem(id: string): void {
    const item = this.state.items.get(id)
    if (!item) return

    const prevItems = new Map(this.state.items)
    this.state.items.delete(id)
    this.state.selectedIds.delete(id)

    this.pushHistory({
      type: 'removeItem',
      data: { id, item },
      undo: () => {
        this.state.items = prevItems
        this.emit('itemsChange', this.getItems())
      },
      redo: () => {
        this.state.items.delete(id)
        this.state.selectedIds.delete(id)
        this.emit('itemsChange', this.getItems())
        this.emit('selectionChange', this.getSelectedIds())
      },
    })

    this.emit('itemsChange', this.getItems())
    this.emit('selectionChange', this.getSelectedIds())
  }

  removeItems(ids: string[]): void {
    this.batch(() => {
      const removedItems = new Map<string, CanvasItem>()
      
      ids.forEach((id) => {
        const item = this.state.items.get(id)
        if (item) {
          removedItems.set(id, item)
          this.state.items.delete(id)
          this.state.selectedIds.delete(id)
        }
      })

      if (removedItems.size === 0) return

      this.pushHistory({
        type: 'removeItems',
        data: { ids: Array.from(removedItems.keys()) },
        undo: () => {
          removedItems.forEach((item, id) => {
            this.state.items.set(id, item)
          })
          this.emit('itemsChange', this.getItems())
        },
        redo: () => {
          removedItems.forEach((_, id) => {
            this.state.items.delete(id)
            this.state.selectedIds.delete(id)
          })
          this.emit('itemsChange', this.getItems())
          this.emit('selectionChange', this.getSelectedIds())
        },
      })

      this.emit('itemsChange', this.getItems())
      this.emit('selectionChange', this.getSelectedIds())
    })
  }

  updateItem(id: string, updates: Partial<CanvasItem>): void {
    const item = this.state.items.get(id)
    if (!item) return

    const prevItem = { ...item }
    const newItem = { ...item, ...updates, id, type: item.type } as CanvasItem
    this.state.items.set(id, newItem)

    this.pushHistory({
      type: 'updateItem',
      data: { id, updates },
      undo: () => {
        this.state.items.set(id, prevItem)
        this.emit('itemsChange', this.getItems())
      },
      redo: () => {
        this.state.items.set(id, newItem)
        this.emit('itemsChange', this.getItems())
      },
    })

    this.emit('itemsChange', this.getItems())
  }

  moveItem(id: string, x: number, y: number): void {
    this.updateItem(id, { x, y })
  }

  moveItems(ids: string[], dx: number, dy: number): void {
    this.batch(() => {
      const prevPositions = new Map<string, { x: number; y: number }>()
      
      ids.forEach((id) => {
        const item = this.state.items.get(id)
        if (item) {
          prevPositions.set(id, { x: item.x, y: item.y })
          this.state.items.set(id, { ...item, x: item.x + dx, y: item.y + dy } as CanvasItem)
        }
      })

      this.pushHistory({
        type: 'moveItems',
        data: { ids, dx, dy },
        undo: () => {
          prevPositions.forEach((pos, id) => {
            const item = this.state.items.get(id)
            if (item) {
              this.state.items.set(id, { ...item, x: pos.x, y: pos.y } as CanvasItem)
            }
          })
          this.emit('itemsChange', this.getItems())
        },
        redo: () => {
          ids.forEach((id) => {
            const item = this.state.items.get(id)
            if (item) {
              const prev = prevPositions.get(id)!
              this.state.items.set(id, { ...item, x: prev.x + dx, y: prev.y + dy } as CanvasItem)
            }
          })
          this.emit('itemsChange', this.getItems())
        },
      })

      this.emit('itemsChange', this.getItems())
    })
  }

  resizeItem(id: string, width: number, height: number): void {
    this.updateItem(id, { width, height })
  }

  resizeItems(ids: string[], scale: number): void {
    this.batch(() => {
      const prevSizes = new Map<string, { width: number; height: number }>()
      
      ids.forEach((id) => {
        const item = this.state.items.get(id)
        if (item) {
          prevSizes.set(id, { width: item.width, height: item.height })
          this.state.items.set(id, {
            ...item,
            width: item.width * scale,
            height: item.height * scale,
          } as CanvasItem)
        }
      })

      this.pushHistory({
        type: 'resizeItems',
        data: { ids, scale },
        undo: () => {
          prevSizes.forEach((size, id) => {
            const item = this.state.items.get(id)
            if (item) {
              this.state.items.set(id, { ...item, width: size.width, height: size.height } as CanvasItem)
            }
          })
          this.emit('itemsChange', this.getItems())
        },
        redo: () => {
          ids.forEach((id) => {
            const item = this.state.items.get(id)
            if (item) {
              const prev = prevSizes.get(id)!
              this.state.items.set(id, {
                ...item,
                width: prev.width * scale,
                height: prev.height * scale,
              } as CanvasItem)
            }
          })
          this.emit('itemsChange', this.getItems())
        },
      })

      this.emit('itemsChange', this.getItems())
    })
  }

  // ==================== SELECTION ====================

  select(id: string): void {
    this.state.selectedIds.clear()
    this.state.selectedIds.add(id)
    this.emit('selectionChange', this.getSelectedIds())
  }

  selectItems(ids: string[]): void {
    this.state.selectedIds.clear()
    ids.forEach((id) => {
      if (this.state.items.has(id)) {
        this.state.selectedIds.add(id)
      }
    })
    this.emit('selectionChange', this.getSelectedIds())
  }

  selectAll(): void {
    this.state.selectedIds.clear()
    this.state.items.forEach((_, id) => {
      this.state.selectedIds.add(id)
    })
    this.emit('selectionChange', this.getSelectedIds())
  }

  selectNone(): void {
    this.state.selectedIds.clear()
    this.emit('selectionChange', this.getSelectedIds())
  }

  toggleSelection(id: string): void {
    if (this.state.selectedIds.has(id)) {
      this.state.selectedIds.delete(id)
    } else if (this.state.items.has(id)) {
      this.state.selectedIds.add(id)
    }
    this.emit('selectionChange', this.getSelectedIds())
  }

  addToSelection(id: string): void {
    if (this.state.items.has(id)) {
      this.state.selectedIds.add(id)
      this.emit('selectionChange', this.getSelectedIds())
    }
  }

  removeFromSelection(id: string): void {
    this.state.selectedIds.delete(id)
    this.emit('selectionChange', this.getSelectedIds())
  }

  // ==================== VIEWPORT ====================

  setViewport(viewport: Partial<Viewport>): void {
    this.state.viewport = { ...this.state.viewport, ...viewport }
    this.emit('viewportChange', this.getViewport())
  }

  pan(dx: number, dy: number): void {
    this.setViewport({
      x: this.state.viewport.x + dx,
      y: this.state.viewport.y + dy,
    })
  }

  zoom(scale: number, center?: { x: number; y: number }): void {
    const prevZoom = this.state.viewport.zoom
    const newZoom = Math.max(0.1, Math.min(10, scale))

    if (center) {
      // Zoom towards center point
      const factor = newZoom / prevZoom
      this.setViewport({
        zoom: newZoom,
        x: center.x - (center.x - this.state.viewport.x) * factor,
        y: center.y - (center.y - this.state.viewport.y) * factor,
      })
    } else {
      this.setViewport({ zoom: newZoom })
    }
  }

  zoomIn(): void {
    this.zoom(this.state.viewport.zoom * 1.2)
  }

  zoomOut(): void {
    this.zoom(this.state.viewport.zoom / 1.2)
  }

  // ==================== TOOLS ====================

  setCurrentTool(tool: ToolType): void {
    this.state.currentTool = tool
    this.emit('toolChange', tool)
  }

  // ==================== GRID ====================

  setGridSettings(settings: Partial<GridSettings>): void {
    this.state.gridSettings = { ...this.state.gridSettings, ...settings }
  }

  // ==================== HISTORY ====================

  private pushHistory(entry: Omit<HistoryEntry, 'id' | 'timestamp'>): void {
    if (this.batchDepth > 0) return // Don't push during batch

    // Remove any redo entries
    this.history = this.history.slice(0, this.historyIndex + 1)

    const historyEntry: HistoryEntry = {
      ...entry,
      id: uniqueId(),
      timestamp: Date.now(),
    }

    this.history.push(historyEntry)
    this.historyIndex = this.history.length - 1

    // Limit history size
    if (this.history.length > this.maxHistoryLength) {
      this.history.shift()
      this.historyIndex--
    }

    this.emit('historyChange', { canUndo: this.canUndo(), canRedo: this.canRedo() })
  }

  canUndo(): boolean {
    return this.historyIndex >= 0
  }

  canRedo(): boolean {
    return this.historyIndex < this.history.length - 1
  }

  undo(): void {
    if (!this.canUndo()) return

    const entry = this.history[this.historyIndex]
    entry.undo()
    this.historyIndex--

    this.emit('historyChange', { canUndo: this.canUndo(), canRedo: this.canRedo() })
  }

  redo(): void {
    if (!this.canRedo()) return

    this.historyIndex++
    const entry = this.history[this.historyIndex]
    entry.redo()

    this.emit('historyChange', { canUndo: this.canUndo(), canRedo: this.canRedo() })
  }

  clearHistory(): void {
    this.history = []
    this.historyIndex = -1
    this.emit('historyChange', { canUndo: false, canRedo: false })
  }

  // ==================== BATCHING ====================

  batch(fn: () => void): void {
    this.batchDepth++
    try {
      fn()
    } finally {
      this.batchDepth--
      if (this.batchDepth === 0) {
        // Flush batched events
        const events = [...this.batchedEvents]
        this.batchedEvents = []
        events.forEach((event) => this.emitImmediate(event))
      }
    }
  }

  // ==================== EVENTS ====================

  on<T = unknown>(type: StoreEventType, listener: Listener<T>): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set())
    }
    this.listeners.get(type)!.add(listener as Listener)
    return () => this.off(type, listener)
  }

  off<T = unknown>(type: StoreEventType, listener: Listener<T>): void {
    this.listeners.get(type)?.delete(listener as Listener)
  }

  private emit<T = unknown>(type: StoreEventType, data: T): void {
    const event: StoreEvent<T> = { type, data }

    if (this.batchDepth > 0) {
      // Deduplicate events during batch
      const existingIndex = this.batchedEvents.findIndex((e) => e.type === type)
      if (existingIndex >= 0) {
        this.batchedEvents[existingIndex] = event
      } else {
        this.batchedEvents.push(event)
      }
    } else {
      this.emitImmediate(event)
    }
  }

  private emitImmediate<T = unknown>(event: StoreEvent<T>): void {
    this.listeners.get(event.type)?.forEach((listener) => {
      try {
        listener(event)
      } catch (error) {
        console.error(`Error in store listener for ${event.type}:`, error)
      }
    })
  }

  // ==================== SNAPSHOT ====================

  getSnapshot(): CanvasSnapshot {
    return {
      version: 1,
      items: this.getItems(),
      viewport: this.getViewport(),
      gridSettings: this.getGridSettings(),
    }
  }

  loadSnapshot(snapshot: CanvasSnapshot): void {
    this.state.items.clear()
    snapshot.items.forEach((item) => {
      this.state.items.set(item.id, item)
    })
    this.state.viewport = { ...snapshot.viewport }
    this.state.gridSettings = { ...snapshot.gridSettings }
    this.state.selectedIds.clear()
    this.clearHistory()

    this.emit('itemsChange', this.getItems())
    this.emit('viewportChange', this.getViewport())
    this.emit('selectionChange', this.getSelectedIds())
  }

  // ==================== CLEAR ====================

  clear(): void {
    this.state.items.clear()
    this.state.selectedIds.clear()
    this.clearHistory()

    this.emit('itemsChange', this.getItems())
    this.emit('selectionChange', this.getSelectedIds())
  }
}
