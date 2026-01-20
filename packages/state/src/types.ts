/**
 * Core types for CloudGrid items and state
 */

// ==================== ITEM TYPES ====================

export type ItemType = 'image' | 'video' | 'text' | 'group'

export interface BaseItem {
  id: string
  type: ItemType
  x: number
  y: number
  width: number
  height: number
  rotation: number
  opacity: number
  locked: boolean
  parentId: string | null // For grouped items
}

export interface ImageItem extends BaseItem {
  type: 'image'
  src: string
  naturalWidth: number
  naturalHeight: number
  crop?: {
    x: number
    y: number
    width: number
    height: number
  }
}

export interface VideoItem extends BaseItem {
  type: 'video'
  src: string
  poster?: string
  naturalWidth: number
  naturalHeight: number
  playing: boolean
  loop: boolean
  muted: boolean
  currentTime: number
}

export interface TextItem extends BaseItem {
  type: 'text'
  content: string
  fontSize: number
  fontFamily: string
  fontWeight: number
  fontStyle: 'normal' | 'italic'
  textAlign: 'left' | 'center' | 'right'
  color: string
  backgroundColor?: string
  lineHeight: number
}

export interface GroupItem extends BaseItem {
  type: 'group'
  childIds: string[]
}

export type CanvasItem = ImageItem | VideoItem | TextItem | GroupItem

// ==================== TOOL TYPES ====================

export type ToolType = 'select' | 'pan' | 'text'

// ==================== VIEWPORT ====================

export interface Viewport {
  x: number
  y: number
  zoom: number
}

// ==================== HISTORY ====================

export interface HistoryEntry {
  id: string
  timestamp: number
  type: string
  data: unknown
  undo: () => void
  redo: () => void
}

// ==================== STORE STATE ====================

export interface GridSettings {
  gridSize: number
  snapToGrid: boolean
  showGrid: boolean
}

export interface CanvasState {
  items: Map<string, CanvasItem>
  selectedIds: Set<string>
  viewport: Viewport
  currentTool: ToolType
  gridSettings: GridSettings
}

// ==================== EVENTS ====================

export type StoreEventType =
  | 'itemsChange'
  | 'selectionChange'
  | 'viewportChange'
  | 'toolChange'
  | 'historyChange'

export interface StoreEvent<T = unknown> {
  type: StoreEventType
  data: T
}

// ==================== SNAPSHOT ====================

export interface CanvasSnapshot {
  version: number
  items: CanvasItem[]
  viewport: Viewport
  gridSettings: GridSettings
}

// ==================== CREATION HELPERS ====================

export type CreateImageItem = Omit<ImageItem, 'id' | 'type' | 'rotation' | 'opacity' | 'locked' | 'parentId'> & {
  id?: string
  rotation?: number
  opacity?: number
  locked?: boolean
}

export type CreateVideoItem = Omit<VideoItem, 'id' | 'type' | 'rotation' | 'opacity' | 'locked' | 'parentId' | 'playing' | 'currentTime'> & {
  id?: string
  rotation?: number
  opacity?: number
  locked?: boolean
  playing?: boolean
  currentTime?: number
}

export type CreateTextItem = Omit<TextItem, 'id' | 'type' | 'rotation' | 'opacity' | 'locked' | 'parentId' | 'width' | 'height'> & {
  id?: string
  width?: number
  height?: number
  rotation?: number
  opacity?: number
  locked?: boolean
}

export type CreateItem = 
  | ({ type: 'image' } & CreateImageItem)
  | ({ type: 'video' } & CreateVideoItem)
  | ({ type: 'text' } & CreateTextItem)
