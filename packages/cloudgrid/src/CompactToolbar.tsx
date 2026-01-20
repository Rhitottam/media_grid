/**
 * Compact floating toolbar - shows only essential tools
 * Can be positioned anywhere in the canvas
 */

import type { ToolType } from '@convadraw/state'
import { Cursor, Hand } from 'phosphor-react'
import { cn } from './lib/utils'
import { Button } from './ui/button'

export type ToolbarPosition = 
  | 'top-left' 
  | 'top-center' 
  | 'top-right' 
  | 'bottom-left' 
  | 'bottom-center' 
  | 'bottom-right'

interface CompactToolbarProps {
  activeTool: ToolType
  onToolChange: (tool: ToolType) => void
  position?: ToolbarPosition
}

const getPositionClasses = (position: ToolbarPosition): string => {
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
      return cn(base, 'top-4 left-4')
  }
}

export function CompactToolbar({ 
  activeTool, 
  onToolChange, 
  position = 'top-left' 
}: CompactToolbarProps) {
  return (
    <div
      className={cn(
        getPositionClasses(position),
        'flex gap-2 p-2 bg-card/95 backdrop-blur-sm rounded-lg border border-border shadow-lg'
      )}
    >
      <Button
        variant={activeTool === 'select' ? 'default' : 'ghost'}
        size="icon"
        onClick={() => onToolChange('select')}
        title="Select Tool (V)"
        className={cn(
          'transition-all',
          activeTool === 'select' && 'scale-105 shadow-md'
        )}
      >
        <Cursor size={20} weight="bold" />
      </Button>
      
      <Button
        variant={activeTool === 'pan' ? 'default' : 'ghost'}
        size="icon"
        onClick={() => onToolChange('pan')}
        title="Pan Tool (H)"
        className={cn(
          'transition-all',
          activeTool === 'pan' && 'scale-105 shadow-md'
        )}
      >
        <Hand size={20} weight="bold" />
      </Button>
    </div>
  )
}
