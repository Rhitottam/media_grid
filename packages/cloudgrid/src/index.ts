// Main components
export { CloudGrid } from './CloudGrid'
export type { CloudGridComponents, CloudGridProps, CloudGridRef } from './CloudGrid'

// Context and hooks
export { CameraProvider, useCamera } from './CameraContext'
export type { CameraControls } from './CameraContext'
export { CloudGridContext, useCloudGrid, useCloudGridOptional } from './CloudGridContext'
export { WasmProvider, useWasm, useWasmRequired } from './WasmContext'

// Toolbar components
export { CompactToolbar, type ToolbarPosition } from './CompactToolbar'
export { DefaultToolbar } from './DefaultToolbar'
export { StatsPanel, type PanelPosition } from './StatsPanel'
export { WASMToolbar } from './WASMToolbar'

// Re-export editor for advanced usage
export { Editor } from '@convadraw/editor'
export type { EditorOptions } from '@convadraw/editor'

// Asset types (primary API for users)
export type {
    Asset,
    BaseAsset,
    CanvasAsset,
    CreateAssetInput,
    ImageAsset,
    ShapeAsset,
    ShapeType,
    TextAsset,
    UpdateAssetInput,
    VideoAsset
} from './types/assets'
export { generateAssetId, isAsset, isCanvasAsset, isImageAsset, isShapeAsset, isTextAsset, isVideoAsset } from './types/assets'

// Re-export commonly used types
export type {
    CanvasItem, CanvasSnapshot, CreateImageItem, CreateItem, CreateTextItem, CreateVideoItem, GridSettings, GroupItem, ImageItem, ItemType, TextItem, ToolType, VideoItem, Viewport
} from '@convadraw/state'

// Re-export primitives for convenience
export { Box, Vec, snapToGrid, uniqueId } from '@convadraw/primitives'

// UI Components
export { Button, buttonVariants } from './ui/button'
export type { ButtonProps } from './ui/button'

// Utils
export { cn } from './lib/utils'

// Helper functions for programmatic control
export { addMedia, deleteSelected, selectItems, sortByColor, zoomToBounds, zoomToSelected } from './helpers'

// Asset metadata management (for advanced usage)
export { getAssetMetadata, setAssetMetadata, updateAssetColor } from './hooks/useCanvasStore'

