import type { CreateItem } from '@convadraw/editor'
import type { CanvasSnapshot, ToolType } from '@convadraw/state'
import React, {
    forwardRef,
    useEffect,
    useImperativeHandle,
    useRef,
    useState,
    type ReactNode,
} from 'react'
import { CameraProvider } from './CameraContext'
import { Canvas } from './Canvas'
import { CloudGridContext } from './CloudGridContext'
import { CompactToolbar, type ToolbarPosition } from './CompactToolbar'
import { StatsPanel, type PanelPosition } from './StatsPanel'
import { WasmProvider } from './WasmContext'
import { syncFromWasm } from './hooks/useCanvasStore'
import { loadWASM, type WASMExports } from './utils/wasmLoader'

// Component slots that can be customized
export interface CloudGridComponents {
  /** Custom toolbar element. Pass null to hide. Use useWasm() hook to access WASM. */
  toolbar?: ReactNode
  /** Custom stats panel element. Pass null to hide. Use useWasm() hook to access WASM. */
  statsPanel?: ReactNode
  /** Custom context menu component. Pass null to hide. Use useWasm() hook to access WASM. */
  ContextMenu?: React.ComponentType | null
  /** Custom loading component shown while initializing */
  Loading?: React.ComponentType
  /** Custom error component */
  Error?: React.ComponentType<{ error: Error }>
}

export interface CloudGridProps {
  /** Initial items to display on the canvas */
  initialItems?: CreateItem[]
  
  /** Grid size in pixels */
  gridSize?: number
  
  /** Whether to snap items to the grid */
  snapToGrid?: boolean
  
  /** Whether to show the grid */
  showGrid?: boolean
  
  /** Minimum zoom level */
  minZoom?: number
  
  /** Maximum zoom level */
  maxZoom?: number
  
  /** Read-only mode - disables editing */
  readOnly?: boolean
  
  /** Initial tool to use */
  initialTool?: ToolType
  
  /** Position of the default toolbar. Set to false to hide. */
  toolbarPosition?: ToolbarPosition | false
  
  /** Position of the default stats panel. Set to false to hide. */
  statsPanelPosition?: PanelPosition | false
  
  /** Show the default toolbar (default: true, ignored if components.toolbar is provided) */
  showToolbar?: boolean
  
  /** Show the default stats panel (default: true, ignored if components.statsPanel is provided) */
  showStatsPanel?: boolean
  
  /** Custom components (toolbar, statsPanel, etc.) */
  components?: CloudGridComponents
  
  /** CSS class name for the container */
  className?: string
  
  /** Inline styles for the container */
  style?: React.CSSProperties
  
  /** Callback when WASM is loaded and ready */
  onMount?: (wasm: WASMExports) => void
  
  /** Callback when items change - TODO: implement with WASM state sync */
  onChange?: (wasm: WASMExports) => void
  
  /** Callback when selection changes - TODO: implement with WASM */
  onSelectionChange?: (selectedIds: string[]) => void
  
  /** Callback when viewport changes - TODO: implement with WASM */
  onViewportChange?: (viewport: { x: number; y: number; zoom: number }) => void
  
  /** Child components (rendered inside the context) */
  children?: ReactNode
}

export interface CloudGridRef {
  /** Get the WASM instance */
  getWASM: () => WASMExports | null
  /** Export canvas as JSON - TODO: implement WASM serialization */
  exportAsJSON: () => string
  /** Load canvas from JSON - TODO: implement WASM deserialization */
  loadFromJSON: (json: string) => void
  /** Load from snapshot - TODO: implement WASM loading */
  loadFromSnapshot: (snapshot: CanvasSnapshot) => void
}

/**
 * CloudGrid - High-performance infinite canvas component
 * 
 * @example
 * ```tsx
 * // Basic usage
 * <CloudGrid />
 * 
 * // With initial items
 * <CloudGrid
 *   initialItems={[
 *     { type: 'image', src: '...', x: 0, y: 0, width: 400, height: 300, naturalWidth: 1920, naturalHeight: 1080 },
 *   ]}
 * />
 * 
 * // With custom toolbar
 * <CloudGrid components={{ Toolbar: MyToolbar }} />
 * 
 * // With ref for imperative access
 * const ref = useRef<CloudGridRef>(null)
 * <CloudGrid ref={ref} />
 * ```
 */
export const CloudGrid = forwardRef<CloudGridRef, CloudGridProps>(function CloudGrid(
  {
    initialItems: _initialItems, // TODO: Add items to WASM after loading
    gridSize = 25,
    snapToGrid = true,
    showGrid: _showGrid, // TODO: Implement grid visibility toggle
    minZoom: _minZoom, // TODO: Implement zoom constraints
    maxZoom: _maxZoom, // TODO: Implement zoom constraints
    readOnly: _readOnly, // TODO: Implement read-only mode
    initialTool = 'select',
    toolbarPosition = 'top-left',
    statsPanelPosition = 'top-right',
    showToolbar = true,
    showStatsPanel = true,
    components = {},
    className,
    style,
    onMount,
    onChange: _onChange, // TODO: Wire up WASM state change callbacks
    onSelectionChange: _onSelectionChange, // TODO: Wire up selection callbacks
    onViewportChange: _onViewportChange, // TODO: Wire up viewport callbacks
    children,
  },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<Error | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [wasm, setWasm] = useState<WASMExports | null>(null)
  const [activeTool, setActiveTool] = useState<ToolType>(initialTool)
  const prevStatsRef = useRef({ visible: 0, total: 0, fps: 0 })

  // Load WASM
  useEffect(() => {
    loadWASM()
      .then(async (wasmInstance) => {
        // Initialize WASM canvas
        wasmInstance.createCanvas(800, 600, gridSize || 25)
        if (snapToGrid !== undefined) wasmInstance.setGridSnap(snapToGrid)
        if (gridSize) wasmInstance.setGridSize(gridSize)
        
        // TODO: Add initialItems to WASM
        // For now, add some test images
        const { registerAsset } = await import('./hooks/useCanvasStore')
        
        const IMAGE_COUNT = 2000
        const COLS = 50
        const IMAGE_WIDTH = 400
        const IMAGE_HEIGHT = 300
        const GAP = 50
        const CELL_WIDTH = IMAGE_WIDTH + GAP
        const CELL_HEIGHT = IMAGE_HEIGHT + GAP
        
        const imageSizes = [
          { w: 1920, h: 1080 },
          { w: 1600, h: 900 },
          { w: 1280, h: 720 },
          { w: 1024, h: 768 },
        ]
        
        for (let i = 0; i < IMAGE_COUNT; i++) {
          const col = i % COLS
          const row = Math.floor(i / COLS)
          const size = imageSizes[i % imageSizes.length]
          const src = `https://picsum.photos/seed/cloudgrid${i}/${size.w}/${size.h}`
          
          const assetId = registerAsset(src)
          wasmInstance.addObject(
            col * CELL_WIDTH,
            row * CELL_HEIGHT,
            IMAGE_WIDTH,
            IMAGE_HEIGHT,
            assetId,
            0 // type: image
          )
        }
        
        setWasm(wasmInstance)
      })
      .catch((err) => {
        setError(err instanceof Error ? err : new Error('Failed to load WASM'))
      })
  }, [])

  // Expose ref methods
  useImperativeHandle(ref, () => ({
    getWASM: () => wasm,
    exportAsJSON: () => {
      // TODO: Implement WASM state serialization
      return '{}'
    },
    loadFromJSON: (json: string) => {
      // TODO: Implement WASM state deserialization
      console.log('loadFromJSON not implemented', json)
    },
    loadFromSnapshot: (snapshot: CanvasSnapshot) => {
      // TODO: Implement WASM loading from snapshot
      console.log('loadFromSnapshot not implemented', snapshot)
    },
  }), [wasm])

  // Call onMount when WASM is ready
  useEffect(() => {
    if (wasm && !isReady) {
      setIsReady(true)
      onMount?.(wasm)
    }
  }, [wasm, isReady, onMount])

  // Render error state
  if (error) {
    const ErrorComponent = components.Error
    if (ErrorComponent) {
      return <ErrorComponent error={error} />
    }
    return (
      <div className="cloudgrid-error" style={{ padding: 20, color: 'red' }}>
        Error: {error.message}
      </div>
    )
  }

  // Render loading state
  if (!wasm || !isReady) {
    const LoadingComponent = components.Loading
    if (LoadingComponent) {
      return <LoadingComponent />
    }
    return (
      <div className="cloudgrid-loading" style={{ padding: 20, color: 'white' }}>
        Loading WASM...
      </div>
    )
  }

  const { toolbar, statsPanel, ContextMenu } = components
  
  const handleStatsUpdate = (visible: number, total: number, fps: number) => {
    if (
      prevStatsRef.current.visible !== visible ||
      prevStatsRef.current.total !== total ||
      prevStatsRef.current.fps !== fps
    ) {
      prevStatsRef.current = { visible, total, fps }
      // Stats updated - TODO: expose via callback
    }
  }

  const handleToolChange = (tool: ToolType) => {
    setActiveTool(tool)
    // Sync WASM state to React after tool change
    if (wasm) {
      syncFromWasm(wasm)
    }
  }
  
  // Determine what to render for toolbar
  const shouldShowDefaultToolbar = showToolbar && toolbarPosition !== false && toolbar === undefined
  const toolbarContent = toolbar !== undefined 
    ? toolbar 
    : (shouldShowDefaultToolbar ? (
        <CompactToolbar 
          activeTool={activeTool} 
          onToolChange={handleToolChange}
          position={toolbarPosition || 'top-left'}
        />
      ) : null)
  
  // Determine what to render for stats panel
  const shouldShowDefaultStatsPanel = showStatsPanel && statsPanelPosition !== false && statsPanel === undefined
  const statsPanelContent = statsPanel !== undefined
    ? statsPanel
    : (shouldShowDefaultStatsPanel ? (
        <StatsPanel position={statsPanelPosition || 'top-right'} />
      ) : null)

  return (
    <CloudGridContext.Provider value={null}>
      <WasmProvider wasm={wasm}>
        <CameraProvider wasm={wasm}>
          <div
            ref={containerRef}
            className={`cloudgrid-container ${className || ''}`}
            style={{
              position: 'relative',
              width: '100%',
              height: '100%',
              overflow: 'hidden',
              background: '#0a0a0a',
              ...style,
            }}
          >
            {/* Main canvas with WASM */}
            <Canvas
              wasm={wasm}
              activeTool={activeTool}
              gridSize={gridSize || 25}
              onStatsUpdate={handleStatsUpdate}
            />

            {/* Floating Toolbar */}
            {toolbarContent}

            {/* Stats Panel */}
            {statsPanelContent}

            {/* Context menu */}
            {ContextMenu && <ContextMenu />}

            {/* Children (custom overlays, etc.) */}
            {children}
          </div>
        </CameraProvider>
      </WasmProvider>
    </CloudGridContext.Provider>
  )
})
