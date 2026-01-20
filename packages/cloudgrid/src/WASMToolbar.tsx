/**
 * WASM-compatible toolbar component
 * Split design: Tools (left) | Stats & Controls (right)
 */

import type { WASMExports } from './utils/wasmLoader'
import type { ToolType } from '@convadraw/state'
import {
  ArrowClockwise,
  ArrowCounterClockwise,
  ArrowsOutSimple,
  Cursor,
  Hand,
  MagnifyingGlassMinus,
  MagnifyingGlassPlus,
} from 'phosphor-react'
import React, { useEffect, useState } from 'react'

interface WASMToolbarProps {
  wasm: WASMExports | null
  activeTool?: ToolType
  onToolChange?: (tool: ToolType) => void
}

export function WASMToolbar({ wasm, activeTool = 'select', onToolChange }: WASMToolbarProps) {
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const [objectCount, setObjectCount] = useState(0)
  const [zoom, setZoom] = useState(100)

  // Poll WASM state
  useEffect(() => {
    if (!wasm) return

    const updateState = () => {
      setCanUndo(wasm.canUndo())
      setCanRedo(wasm.canRedo())
      setObjectCount(wasm.getObjectCount())
      setZoom(Math.round(wasm.getCameraZoom() * 100))
    }

    updateState()
    const interval = setInterval(updateState, 100)

    return () => clearInterval(interval)
  }, [wasm])

  if (!wasm) return null

  const buttonBase: React.CSSProperties = {
    padding: '8px 12px',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'all 0.15s ease',
    fontWeight: 500,
  }

  const toolButton = (isActive: boolean): React.CSSProperties => ({
    ...buttonBase,
    backgroundColor: isActive ? '#4CAF50' : '#2a2a2a',
    color: isActive ? 'white' : '#999',
    transform: isActive ? 'scale(1.05)' : 'scale(1)',
  })

  const actionButton = (disabled: boolean = false): React.CSSProperties => ({
    ...buttonBase,
    backgroundColor: disabled ? '#222' : '#333',
    color: disabled ? '#555' : '#ddd',
    opacity: disabled ? 0.5 : 1,
    cursor: disabled ? 'not-allowed' : 'pointer',
  })

  const handleToolChange = (tool: ToolType) => {
    onToolChange?.(tool)
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 16px',
        backgroundColor: '#1a1a1a',
        borderBottom: '1px solid #333',
        gap: '16px',
      }}
    >
      {/* LEFT: Tools Only */}
      <div style={{ display: 'flex', gap: '6px' }}>
        <button
          style={toolButton(activeTool === 'select')}
          onClick={() => handleToolChange('select')}
          title="Select Tool (V)"
        >
          <Cursor size={18} weight="bold" />
          <span>Select</span>
        </button>
        <button
          style={toolButton(activeTool === 'pan')}
          onClick={() => handleToolChange('pan')}
          title="Pan Tool (H)"
        >
          <Hand size={18} weight="bold" />
          <span>Pan</span>
        </button>
      </div>

      {/* RIGHT: Stats & Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {/* History */}
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            style={actionButton(!canUndo)}
            onClick={() => canUndo && wasm.undo()}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
          >
            <ArrowCounterClockwise size={16} weight="bold" />
          </button>
          <button
            style={actionButton(!canRedo)}
            onClick={() => canRedo && wasm.redo()}
            disabled={!canRedo}
            title="Redo (Ctrl+Shift+Z)"
          >
            <ArrowClockwise size={16} weight="bold" />
          </button>
        </div>

        {/* Separator */}
        <div style={{ width: '1px', height: '20px', backgroundColor: '#444' }} />

        {/* Zoom Controls */}
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          <button
            style={actionButton()}
            onClick={() => wasm.zoom(0.9, 0, 0)}
            title="Zoom Out (-)"
          >
            <MagnifyingGlassMinus size={16} weight="bold" />
          </button>
          <span style={{ fontSize: '12px', color: '#999', minWidth: '45px', textAlign: 'center' }}>
            {zoom}%
          </span>
          <button
            style={actionButton()}
            onClick={() => wasm.zoom(1.1, 0, 0)}
            title="Zoom In (+)"
          >
            <MagnifyingGlassPlus size={16} weight="bold" />
          </button>
          <button
            style={actionButton()}
            onClick={() => {
              wasm.zoom(1.0, 0, 0)
              const currentX = wasm.getCameraX()
              const currentY = wasm.getCameraY()
              wasm.pan(-currentX, -currentY)
            }}
            title="Reset View (0)"
          >
            <ArrowsOutSimple size={16} weight="bold" />
          </button>
        </div>

        {/* Separator */}
        <div style={{ width: '1px', height: '20px', backgroundColor: '#444' }} />

        {/* Stats */}
        <div style={{ fontSize: '12px', color: '#999' }}>
          <span style={{ color: '#4CAF50', fontWeight: 600 }}>{objectCount.toLocaleString()}</span>
          {' '}objects
        </div>
      </div>
    </div>
  )
}
