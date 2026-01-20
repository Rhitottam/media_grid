import type { Editor } from '@convadraw/editor'
import type { ToolType } from '@convadraw/state'
import {
    ArrowClockwise,
    ArrowCounterClockwise,
    ArrowsOutSimple,
    Cursor,
    Hand,
    MagnifyingGlassMinus,
    MagnifyingGlassPlus,
    Trash,
} from 'phosphor-react'
import React, { useEffect, useState } from 'react'

interface DefaultToolbarProps {
  editor: Editor
}

/**
 * Default toolbar component for CloudGrid
 * Can be customized or replaced entirely
 */
export function DefaultToolbar({ editor }: DefaultToolbarProps) {
  const [currentTool, setCurrentTool] = useState<ToolType>(editor.getCurrentTool())
  const [canUndo, setCanUndo] = useState(editor.canUndo())
  const [canRedo, setCanRedo] = useState(editor.canRedo())
  const [selectedCount, setSelectedCount] = useState(editor.getSelectedIds().length)

  // Subscribe to editor events
  useEffect(() => {
    const unsubs = [
      editor.on('toolChange', (e) => setCurrentTool(e.data as ToolType)),
      editor.on('historyChange', () => {
        setCanUndo(editor.canUndo())
        setCanRedo(editor.canRedo())
      }),
      editor.on('selectionChange', () => {
        setSelectedCount(editor.getSelectedIds().length)
      }),
    ]

    return () => unsubs.forEach((unsub) => unsub())
  }, [editor])

  const buttonStyle: React.CSSProperties = {
    padding: '8px 12px',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'background-color 0.2s',
  }

  const activeStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: '#4CAF50',
    color: 'white',
  }

  const inactiveStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: '#e0e0e0',
    color: '#333',
  }

  const disabledStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: '#f5f5f5',
    color: '#bbb',
    cursor: 'not-allowed',
  }

  return (
    <div
      className="cloudgrid-toolbar"
      style={{
        position: 'absolute',
        top: 10,
        left: 10,
        zIndex: 100,
        display: 'flex',
        gap: '8px',
        padding: '8px',
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      }}
    >
      {/* Tool buttons */}
      <div style={{ display: 'flex', gap: '4px' }}>
        <button
          style={currentTool === 'select' ? activeStyle : inactiveStyle}
          onClick={() => editor.setCurrentTool('select')}
          title="Select (V)"
        >
          <Cursor size={16} weight="bold" style={{ marginRight: 4 }} />
          Select
        </button>
        <button
          style={currentTool === 'pan' ? activeStyle : inactiveStyle}
          onClick={() => editor.setCurrentTool('pan')}
          title="Pan (H)"
        >
          <Hand size={16} weight="bold" style={{ marginRight: 4 }} />
          Pan
        </button>
      </div>

      <div style={{ width: 1, backgroundColor: '#ddd' }} />

      {/* History buttons */}
      <div style={{ display: 'flex', gap: '4px' }}>
        <button
          style={canUndo ? inactiveStyle : disabledStyle}
          onClick={() => editor.undo()}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
        >
          <ArrowCounterClockwise size={16} weight="bold" />
        </button>
        <button
          style={canRedo ? inactiveStyle : disabledStyle}
          onClick={() => editor.redo()}
          disabled={!canRedo}
          title="Redo (Ctrl+Shift+Z)"
        >
          <ArrowClockwise size={16} weight="bold" />
        </button>
      </div>

      <div style={{ width: 1, backgroundColor: '#ddd' }} />

      {/* Zoom buttons */}
      <div style={{ display: 'flex', gap: '4px' }}>
        <button
          style={inactiveStyle}
          onClick={() => editor.zoomOut()}
          title="Zoom Out"
        >
          <MagnifyingGlassMinus size={16} weight="bold" />
        </button>
        <button
          style={inactiveStyle}
          onClick={() => editor.zoomIn()}
          title="Zoom In"
        >
          <MagnifyingGlassPlus size={16} weight="bold" />
        </button>
        <button
          style={inactiveStyle}
          onClick={() => editor.zoomToFit()}
          title="Fit to Content"
        >
          <ArrowsOutSimple size={16} weight="bold" />
        </button>
      </div>

      {/* Selection info */}
      {selectedCount > 0 && (
        <>
          <div style={{ width: 1, backgroundColor: '#ddd' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '14px', color: '#666' }}>
              {selectedCount} selected
            </span>
            <button
              style={{ ...inactiveStyle, backgroundColor: '#ff5252', color: 'white' }}
              onClick={() => editor.deleteSelected()}
              title="Delete Selected"
            >
              <Trash size={16} weight="bold" style={{ marginRight: 4 }} />
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  )
}
