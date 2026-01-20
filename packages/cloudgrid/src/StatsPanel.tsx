/**
 * Stats and controls panel - shows zoom, undo/redo, and object count
 * Separate from toolbar for flexible positioning
 */

import {
  ArrowClockwise,
  ArrowCounterClockwise,
  ArrowsOutSimple,
  MagnifyingGlassMinus,
  MagnifyingGlassPlus,
  Palette,
  Plus,
  Trash,
} from 'phosphor-react'
import { useEffect, useState } from 'react'
import { useCamera } from './CameraContext'
import { useWasm } from './WasmContext'
import { syncFromWasm } from './hooks/useCanvasStore'
import { cn } from './lib/utils'
import { Button } from './ui/button'

export type PanelPosition = 
  | 'top-left' 
  | 'top-center' 
  | 'top-right' 
  | 'bottom-left' 
  | 'bottom-center' 
  | 'bottom-right'

interface StatsPanelProps {
  position?: PanelPosition
}

const getPositionClasses = (position: PanelPosition): string => {
  const base = 'absolute z-[100]'

  switch (position) {
    case 'top-left':
      return cn(base, 'top-4 left-4')
    case 'top-center':
      return cn(base, 'top-4 left-1/2 -translate-x-1/2')
    case 'top-right':
      return cn(base, 'top-4 right-4')
    case 'bottom-left':
      return cn(base, 'bottom-4 left-4')
    case 'bottom-center':
      return cn(base, 'bottom-4 left-1/2 -translate-x-1/2')
    case 'bottom-right':
      return cn(base, 'bottom-4 right-4')
    default:
      return cn(base, 'top-4 right-4')
  }
}

export function StatsPanel({ position = 'top-right' }: StatsPanelProps) {
  const wasm = useWasm()
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const [objectCount, setObjectCount] = useState(0)
  
  // Use camera context for zoom state and controls
  const camera = useCamera()
  const zoom = Math.round(camera.scale * 100)

  useEffect(() => {
    if (!wasm) return

    const updateState = () => {
      setCanUndo(wasm.canUndo())
      setCanRedo(wasm.canRedo())
      setObjectCount(wasm.getObjectCount())
    }

    updateState()
    const interval = setInterval(updateState, 100)

    return () => clearInterval(interval)
  }, [wasm])

  if (!wasm) return null

  const handleZoomIn = () => {
    // Zoom in by 10% at the center of the viewport
    camera.zoom(1.1, 0, 0)
  }

  const handleZoomOut = () => {
    // Zoom out by 10% at the center of the viewport
    camera.zoom(0.9, 0, 0)
  }

  const handleUndo = () => {
    if (canUndo) {
      wasm.undo()
      syncFromWasm(wasm) // Sync WASM object state to React
      setCanUndo(wasm.canUndo())
      setCanRedo(wasm.canRedo())
    }
  }

  const handleRedo = () => {
    if (canRedo) {
      wasm.redo()
      syncFromWasm(wasm) // Sync WASM object state to React
      setCanUndo(wasm.canUndo())
      setCanRedo(wasm.canRedo())
    }
  }

  const handleResetView = () => {
    // Reset camera to initial state
    camera.resetView()
  }

  const handleSortByColor = () => {
    // Dispatch custom event for Canvas to handle
    window.dispatchEvent(new CustomEvent('sort-by-color'))
  }

  const handleAddMedia = () => {
    // Dispatch custom event for Canvas to handle
    window.dispatchEvent(new CustomEvent('add-media'))
  }

  const handleDeleteSelected = () => {
    // Dispatch custom event for Canvas to handle
    window.dispatchEvent(new CustomEvent('delete-selected'))
  }

  return (
    <div
      className={cn(
        getPositionClasses(position),
        'flex flex-col gap-2 p-2 bg-card/95 backdrop-blur-sm rounded-lg border border-border shadow-lg'
      )}
    >
      {/* History Controls */}
      <div className="flex gap-1 items-center">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleUndo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          className="h-8 w-8"
        >
          <ArrowCounterClockwise size={16} weight="bold" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleRedo}
          disabled={!canRedo}
          title="Redo (Ctrl+Shift+Z)"
          className="h-8 w-8"
        >
          <ArrowClockwise size={16} weight="bold" />
        </Button>
      </div>

      {/* Separator */}
      <div className="h-px bg-border" />

      {/* Zoom Controls */}
      <div className="flex gap-1 items-center">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleZoomOut}
          title="Zoom Out (-)"
          className="h-8 w-8"
        >
          <MagnifyingGlassMinus size={16} weight="bold" />
        </Button>
        <span className="text-xs text-accent font-semibold min-w-[45px] text-center font-mono">
          {zoom}%
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleZoomIn}
          title="Zoom In (+)"
          className="h-8 w-8"
        >
          <MagnifyingGlassPlus size={16} weight="bold" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleResetView}
          title="Reset View"
          className="h-8 w-8"
        >
          <ArrowsOutSimple size={16} weight="bold" />
        </Button>
      </div>

      {/* Separator */}
      <div className="h-px bg-border" />

      {/* Media Tools */}
      <div className="flex gap-1 items-center">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleAddMedia}
          title="Add Media"
          className="h-8 w-8"
        >
          <Plus size={16} weight="bold" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDeleteSelected}
          title="Delete Selected"
          className="h-8 w-8"
        >
          <Trash size={16} weight="bold" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleSortByColor}
          title="Sort by Color (RGB Gradient)"
          className="h-8 w-8"
        >
          <Palette size={16} weight="bold" />
        </Button>
      </div>

      {/* Separator */}
      <div className="h-px bg-border" />

      {/* Stats */}
      <div className="text-xs text-muted-foreground text-center">
        <span className="text-accent font-semibold font-mono">
          {objectCount.toLocaleString()}
        </span>
        {' '}items
      </div>
    </div>
  )
}
