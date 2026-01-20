import type { Editor } from '@convadraw/editor'
import type { CanvasItem, ImageItem, ToolType } from '@convadraw/state'
import Konva from 'konva'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Image as KonvaImage, Layer, Rect, Stage, Transformer } from 'react-konva'

// Import inlined workers
import { createGridWorker, createImageLoaderWorker } from './workers/createWorker'

interface GridCanvasProps {
  editor: Editor
  readOnly?: boolean
}

// ============= Image Loading with LOD =============
// Resolution levels - same URL decoded at different sizes
const LOD_LEVELS = {
  small: 150,   // For thumbnails / zoomed out
  medium: 400,  // For normal view
  full: 0,      // 0 = original resolution
} as const

type LODLevel = keyof typeof LOD_LEVELS

// Track which blobs are cached in the worker
const cachedBlobs = new Set<string>()
const loadingBlobs = new Set<string>()

// Track decoded bitmaps with their current LOD level
interface DecodedEntry {
  bitmap: ImageBitmap
  level: LODLevel
}
const decodedBitmaps = new Map<string, DecodedEntry>()
const decodingImages = new Map<string, LODLevel>()

let imageWorker: Worker | null = null

// Determine which LOD level to use based on display size
function getLODLevel(displayWidth: number, displayHeight: number): LODLevel {
  const maxDim = Math.max(displayWidth, displayHeight)
  if (maxDim <= 150) return 'small'
  if (maxDim <= 400) return 'medium'
  return 'full'
}

function getImageWorker(): Worker {
  if (!imageWorker) {
    imageWorker = createImageLoaderWorker()
    imageWorker.onmessage = (e) => {
      const { type, id, bitmap, requestedMaxDim } = e.data
      
      if (type === 'cached') {
        cachedBlobs.add(id)
        loadingBlobs.delete(id)
        window.dispatchEvent(new CustomEvent('blob-cached', { detail: { id } }))
      } else if (type === 'decoded' && bitmap) {
        const level = decodingImages.get(id) || 
          (requestedMaxDim === 150 ? 'small' : requestedMaxDim === 400 ? 'medium' : 'full')
        decodingImages.delete(id)
        
        const existing = decodedBitmaps.get(id)
        if (existing) {
          try { existing.bitmap.close() } catch { /* ignore */ }
        }
        
        decodedBitmaps.set(id, { bitmap, level })
        window.dispatchEvent(new CustomEvent('image-decoded', { detail: { id, level } }))
      } else if (type === 'error') {
        loadingBlobs.delete(id)
        decodingImages.delete(id)
      }
    }
  }
  return imageWorker
}

function requestBlobCache(src: string): void {
  if (cachedBlobs.has(src) || loadingBlobs.has(src)) return
  loadingBlobs.add(src)
  const worker = getImageWorker()
  worker.postMessage({ type: 'load', id: src, src })
}

function requestDecode(src: string, level: LODLevel): void {
  if (!cachedBlobs.has(src)) return
  
  const currentlyDecoding = decodingImages.get(src)
  if (currentlyDecoding) {
    const levels: LODLevel[] = ['small', 'medium', 'full']
    if (levels.indexOf(currentlyDecoding) >= levels.indexOf(level)) return
  }
  
  decodingImages.set(src, level)
  const worker = getImageWorker()
  const maxDim = LOD_LEVELS[level]
  worker.postMessage({ type: 'decode', id: src, maxDim })
}

function releaseBitmap(src: string): void {
  const entry = decodedBitmaps.get(src)
  if (entry) {
    try { entry.bitmap.close() } catch { /* ignore */ }
    decodedBitmaps.delete(src)
  }
  decodingImages.delete(src)
}

function useImageOnDemand(
  src: string,
  displayWidth: number,
  displayHeight: number,
  isVisible: boolean
): ImageBitmap | undefined {
  const [, forceUpdate] = useState(0)
  const neededLevel = getLODLevel(displayWidth, displayHeight)

  useEffect(() => {
    if (!isVisible) return
    
    requestBlobCache(src)
    
    const handleCached = (e: CustomEvent) => {
      if (e.detail.id === src) {
        requestDecode(src, neededLevel)
      }
    }
    
    const handleDecoded = (e: CustomEvent) => {
      if (e.detail.id === src) {
        forceUpdate((n) => n + 1)
      }
    }
    
    window.addEventListener('blob-cached', handleCached as EventListener)
    window.addEventListener('image-decoded', handleDecoded as EventListener)
    
    if (cachedBlobs.has(src)) {
      const existing = decodedBitmaps.get(src)
      if (!existing) {
        requestDecode(src, neededLevel)
      } else {
        const levels: LODLevel[] = ['small', 'medium', 'full']
        const currentIdx = levels.indexOf(existing.level)
        const neededIdx = levels.indexOf(neededLevel)
        if (neededIdx > currentIdx && !decodingImages.has(src)) {
          requestDecode(src, neededLevel)
        }
      }
    }
    
    return () => {
      window.removeEventListener('blob-cached', handleCached as EventListener)
      window.removeEventListener('image-decoded', handleDecoded as EventListener)
    }
  }, [src, isVisible, neededLevel])

  useEffect(() => {
    if (!isVisible) {
      releaseBitmap(src)
    }
  }, [src, isVisible])

  const entry = decodedBitmaps.get(src)
  return isVisible ? entry?.bitmap : undefined
}

// ============= Components =============

interface CanvasImageNodeProps {
  item: ImageItem
  isSelected: boolean
  onSelect: (shiftKey: boolean) => void
  onDragEnd: (x: number, y: number) => void
  onTransformEnd: (width: number, height: number) => void
  readOnly: boolean
  scale: number
  nodeRef: (node: Konva.Image | null) => void
}

function CanvasImageNode({
  item,
  isSelected,
  onSelect,
  onDragEnd,
  onTransformEnd,
  readOnly,
  scale,
  nodeRef,
}: CanvasImageNodeProps) {
  const shapeRef = useRef<Konva.Image>(null)
  const displayWidth = item.width * scale
  const displayHeight = item.height * scale
  const bitmap = useImageOnDemand(item.src, displayWidth, displayHeight, true)

  useEffect(() => {
    nodeRef(shapeRef.current)
  }, [nodeRef, bitmap])

  const handleClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!readOnly) {
      onSelect(e.evt.shiftKey)
    }
  }

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    if (readOnly) return
    onDragEnd(e.target.x(), e.target.y())
  }

  const handleTransformEnd = () => {
    if (readOnly) return
    const node = shapeRef.current
    if (!node) return

    const scaleX = node.scaleX()
    const scaleY = node.scaleY()

    node.scaleX(1)
    node.scaleY(1)

    onTransformEnd(
      Math.max(10, node.width() * scaleX),
      Math.max(10, node.height() * scaleY)
    )
  }

  if (!bitmap) {
    return (
      <Rect
        x={item.x}
        y={item.y}
        width={item.width}
        height={item.height}
        fill="rgba(100, 100, 100, 0.3)"
        stroke={isSelected ? '#4CAF50' : 'transparent'}
        strokeWidth={2}
      />
    )
  }

  return (
    <KonvaImage
      ref={shapeRef}
      image={bitmap}
      x={item.x}
      y={item.y}
      width={item.width}
      height={item.height}
      draggable={!readOnly}
      onClick={handleClick}
      onTap={handleClick}
      onDragEnd={handleDragEnd}
      onTransformEnd={handleTransformEnd}
    />
  )
}

interface GridDotsProps {
  width: number
  height: number
  gridSize: number
  stageX: number
  stageY: number
  scale: number
}

function GridDots({ width, height, gridSize, stageX, stageY, scale }: GridDotsProps) {
  const [gridBitmap, setGridBitmap] = useState<ImageBitmap | null>(null)
  const workerRef = useRef<Worker | null>(null)
  const pendingRef = useRef(false)

  useEffect(() => {
    if (!workerRef.current) {
      workerRef.current = createGridWorker()
      workerRef.current.onmessage = (e) => {
        if (e.data.type === 'rendered') {
          setGridBitmap(e.data.bitmap)
          pendingRef.current = false
        }
      }
    }

    if (pendingRef.current || !workerRef.current) return

    pendingRef.current = true
    workerRef.current.postMessage({ type: 'render', width, height, gridSize, stageX, stageY, scale })
  }, [width, height, gridSize, stageX, stageY, scale])

  useEffect(
    () => () => {
      workerRef.current?.terminate()
    },
    []
  )

  if (!gridBitmap) return null

  return (
    <KonvaImage
      image={gridBitmap}
      x={-stageX / scale}
      y={-stageY / scale}
      width={width / scale}
      height={height / scale}
      listening={false}
    />
  )
}

export function GridCanvas({ editor, readOnly = false }: GridCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Konva.Stage>(null)
  const transformerRef = useRef<Konva.Transformer>(null)
  const imageNodesRef = useRef<Map<string, Konva.Image | null>>(new Map())

  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 })
  const [scale, setScale] = useState(1)
  const [items, setItems] = useState<CanvasItem[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [currentTool, setCurrentTool] = useState<ToolType>('select')
  const isPanningRef = useRef(false)
  const lastPointerPosRef = useRef<{ x: number; y: number } | null>(null)

  // Sync state from editor
  useEffect(() => {
    const updateItems = () => setItems(editor.getItems())
    const updateSelection = () => setSelectedIds(editor.getSelectedIds())
    const updateViewport = () => {
      const viewport = editor.getViewport()
      setStagePos({ x: viewport.x, y: viewport.y })
      setScale(viewport.zoom)
    }
    const updateTool = () => setCurrentTool(editor.getCurrentTool())

    updateItems()
    updateSelection()
    updateViewport()
    updateTool()

    const unsubs = [
      editor.on('itemsChange', updateItems),
      editor.on('selectionChange', updateSelection),
      editor.on('viewportChange', updateViewport),
      editor.on('toolChange', updateTool),
    ]

    return () => unsubs.forEach((unsub) => unsub())
  }, [editor])

  // Update container dimensions
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        setDimensions({ width: Math.floor(rect.width), height: Math.floor(rect.height) })
      }
    }
    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [])

  // Update transformer when selection changes
  useEffect(() => {
    if (!transformerRef.current || readOnly) return

    const nodes: Konva.Node[] = []
    selectedIds.forEach((id) => {
      const node = imageNodesRef.current.get(id)
      if (node) nodes.push(node)
    })

    transformerRef.current.nodes(nodes)
    transformerRef.current.getLayer()?.batchDraw()
  }, [selectedIds, readOnly])

  // Viewport culling
  const visibleItems = useMemo(() => {
    const padding = 200
    const worldLeft = -stagePos.x / scale - padding
    const worldTop = -stagePos.y / scale - padding
    const worldRight = worldLeft + dimensions.width / scale + padding * 2
    const worldBottom = worldTop + dimensions.height / scale + padding * 2

    return items.filter((item) => {
      const itemRight = item.x + item.width
      const itemBottom = item.y + item.height
      return !(itemRight < worldLeft || item.x > worldRight || itemBottom < worldTop || item.y > worldBottom)
    })
  }, [items, stagePos.x, stagePos.y, scale, dimensions.width, dimensions.height])

  // Handle wheel zoom/pan
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()

      if (e.ctrlKey || e.metaKey) {
        const stage = stageRef.current
        if (!stage) return

        const pointer = stage.getPointerPosition()
        if (!pointer) return

        const oldScale = scale
        const scaleBy = 1.1
        const newScale = e.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy
        const clampedScale = Math.max(0.1, Math.min(10, newScale))

        const mousePointTo = {
          x: (pointer.x - stagePos.x) / oldScale,
          y: (pointer.y - stagePos.y) / oldScale,
        }

        const newPos = {
          x: pointer.x - mousePointTo.x * clampedScale,
          y: pointer.y - mousePointTo.y * clampedScale,
        }

        editor.setViewport({ x: newPos.x, y: newPos.y, zoom: clampedScale })
      } else {
        editor.pan(-e.deltaX, -e.deltaY)
      }
    }

    container.addEventListener('wheel', handleWheel, { passive: false })
    return () => container.removeEventListener('wheel', handleWheel)
  }, [editor, scale, stagePos])

  // Handle stage mouse down (for panning)
  const handleStageMouseDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (currentTool === 'pan') {
        isPanningRef.current = true
        const stage = e.target.getStage()
        if (stage) {
          const pointer = stage.getPointerPosition()
          if (pointer) {
            lastPointerPosRef.current = pointer
          }
        }
      }
    },
    [currentTool]
  )

  // Handle stage mouse move (for panning)
  const handleStageMouseMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (currentTool === 'pan' && isPanningRef.current && lastPointerPosRef.current) {
        const stage = e.target.getStage()
        if (stage) {
          const pointer = stage.getPointerPosition()
          if (pointer) {
            const dx = pointer.x - lastPointerPosRef.current.x
            const dy = pointer.y - lastPointerPosRef.current.y
            editor.pan(dx, dy)
            lastPointerPosRef.current = pointer
          }
        }
      }
    },
    [currentTool, editor]
  )

  // Handle stage mouse up (for panning)
  const handleStageMouseUp = useCallback(() => {
    isPanningRef.current = false
    lastPointerPosRef.current = null
  }, [])

  // Handle stage click (deselect)
  const handleStageClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (e.target === e.target.getStage() && !readOnly && currentTool === 'select') {
        editor.selectNone()
      }
    },
    [editor, readOnly, currentTool]
  )

  const handleItemSelect = useCallback(
    (id: string, shiftKey: boolean) => {
      if (shiftKey) {
        editor.toggleSelection(id)
      } else {
        editor.select(id)
      }
    },
    [editor]
  )

  const handleItemDragEnd = useCallback(
    (id: string, x: number, y: number) => {
      editor.moveItem(id, { x, y })
    },
    [editor]
  )

  const handleItemTransformEnd = useCallback(
    (id: string, width: number, height: number) => {
      editor.resizeItem(id, { width, height })
    },
    [editor]
  )

  const gridSettings = editor.getGridSettings()

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        inset: 0,
        cursor: currentTool === 'pan' ? (isPanningRef.current ? 'grabbing' : 'grab') : 'default',
      }}
    >
      <Stage
        ref={stageRef}
        width={dimensions.width}
        height={dimensions.height}
        x={stagePos.x}
        y={stagePos.y}
        scaleX={scale}
        scaleY={scale}
        onPointerDown={handleStageMouseDown}
        onPointerMove={handleStageMouseMove}
        onPointerUp={handleStageMouseUp}
        onPointerLeave={handleStageMouseUp}
        onClick={handleStageClick}
        onTap={handleStageClick}
      >
        {/* Grid layer */}
        {gridSettings.showGrid && (
          <Layer listening={false}>
            <GridDots
              width={dimensions.width}
              height={dimensions.height}
              gridSize={gridSettings.gridSize}
              stageX={stagePos.x}
              stageY={stagePos.y}
              scale={scale}
            />
          </Layer>
        )}

        {/* Items layer */}
        <Layer>
          {visibleItems.map((item) => {
            if (item.type === 'image') {
              return (
                <CanvasImageNode
                  key={item.id}
                  item={item as ImageItem}
                  isSelected={selectedIds.includes(item.id)}
                  onSelect={(shiftKey) => handleItemSelect(item.id, shiftKey)}
                  onDragEnd={(x, y) => handleItemDragEnd(item.id, x, y)}
                  onTransformEnd={(w, h) => handleItemTransformEnd(item.id, w, h)}
                  readOnly={readOnly}
                  scale={scale}
                  nodeRef={(node) => imageNodesRef.current.set(item.id, node)}
                />
              )
            }
            return null
          })}

          {/* Selection transformer */}
          {!readOnly && currentTool === 'select' && (
            <Transformer
              ref={transformerRef}
              boundBoxFunc={(oldBox, newBox) => {
                if (newBox.width < 10 || newBox.height < 10) {
                  return oldBox
                }
                return newBox
              }}
              keepRatio={true}
              enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
            />
          )}
        </Layer>
      </Stage>
    </div>
  )
}
