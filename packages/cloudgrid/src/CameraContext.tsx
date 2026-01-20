/**
 * Camera Context - shared camera state between Canvas and controls
 * Manages zoom and pan state with optional WASM sync
 */

import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import type { WASMExports } from './utils/wasmLoader';

export interface CameraControls {
  // Current state
  scale: number
  stagePos: { x: number; y: number }
  
  // Setters
  setScale: (scale: number) => void
  setStagePos: (pos: { x: number; y: number }) => void
  
  // High-level actions
  zoom: (factor: number, centerX?: number, centerY?: number) => void
  zoomTo: (newScale: number, centerX?: number, centerY?: number) => void
  pan: (dx: number, dy: number) => void
  resetView: () => void
  
  // Animated actions
  animateToPosition: (x: number, y: number, targetScale?: number, duration?: number) => void
  zoomToFit: (bounds: { x: number; y: number; width: number; height: number }, padding?: number, duration?: number) => void
}

const CameraContext = createContext<CameraControls | null>(null)

interface CameraProviderProps {
  wasm: WASMExports | null
  children: React.ReactNode
}

export function CameraProvider({ wasm, children }: CameraProviderProps) {
  const [scale, setScaleState] = useState(1)
  const [stagePos, setStagePosState] = useState({ x: 0, y: 0 })
  const wasmSyncTimeoutRef = useRef<NodeJS.Timeout>()

  // Debounced WASM sync (optional - for future integration)
  const syncToWASM = useCallback(
    (_newScale: number, _newPos: { x: number; y: number }) => {
      if (!wasm) return
      
      // Clear previous timeout
      if (wasmSyncTimeoutRef.current) {
        clearTimeout(wasmSyncTimeoutRef.current)
      }
      
      // Debounce WASM sync by 150ms
      wasmSyncTimeoutRef.current = setTimeout(() => {
        // TODO: Sync to WASM if needed in the future
        // For now, WASM has its own camera that's not used by Canvas
      }, 150)
    },
    [wasm]
  )

  const setScale = useCallback((newScale: number) => {
    setScaleState(newScale)
    syncToWASM(newScale, stagePos)
  }, [stagePos, syncToWASM])

  const setStagePos = useCallback((newPos: { x: number; y: number }) => {
    setStagePosState(newPos)
    syncToWASM(scale, newPos)
  }, [scale, syncToWASM])

  const zoom = useCallback(
    (factor: number, centerX: number = 0, centerY: number = 0) => {
      const newScale = Math.max(0.1, Math.min(10, scale * factor))
      
      // Zoom around the center point
      const mousePointTo = {
        x: (centerX - stagePos.x) / scale,
        y: (centerY - stagePos.y) / scale,
      }
      
      const newPos = {
        x: centerX - mousePointTo.x * newScale,
        y: centerY - mousePointTo.y * newScale,
      }
      
      setScaleState(newScale)
      setStagePosState(newPos)
      syncToWASM(newScale, newPos)
    },
    [scale, stagePos, syncToWASM]
  )

  const zoomTo = useCallback(
    (newScale: number, centerX: number = 0, centerY: number = 0) => {
      const clampedScale = Math.max(0.1, Math.min(10, newScale))
      
      const mousePointTo = {
        x: (centerX - stagePos.x) / scale,
        y: (centerY - stagePos.y) / scale,
      }
      
      const newPos = {
        x: centerX - mousePointTo.x * clampedScale,
        y: centerY - mousePointTo.y * clampedScale,
      }
      
      setScaleState(clampedScale)
      setStagePosState(newPos)
      syncToWASM(clampedScale, newPos)
    },
    [scale, stagePos, syncToWASM]
  )

  const pan = useCallback(
    (dx: number, dy: number) => {
      const newPos = {
        x: stagePos.x + dx,
        y: stagePos.y + dy,
      }
      setStagePosState(newPos)
      syncToWASM(scale, newPos)
    },
    [stagePos, scale, syncToWASM]
  )

  const resetView = useCallback(() => {
    setScaleState(1)
    setStagePosState({ x: 0, y: 0 })
    syncToWASM(1, { x: 0, y: 0 })
  }, [syncToWASM])

  const animateToPosition = useCallback(
    (targetX: number, targetY: number, targetScale: number = scale, duration: number = 500) => {
      const startScale = scale
      const startPos = { ...stagePos }
      const startTime = Date.now()
      
      const animate = () => {
        const elapsed = Date.now() - startTime
        const progress = Math.min(elapsed / duration, 1)
        
        // Easing function (ease-in-out)
        const eased = progress < 0.5
          ? 2 * progress * progress
          : -1 + (4 - 2 * progress) * progress
        
        // Interpolate scale
        const currentScale = startScale + (targetScale - startScale) * eased
        
        // Interpolate position
        const currentPos = {
          x: startPos.x + (targetX - startPos.x) * eased,
          y: startPos.y + (targetY - startPos.y) * eased,
        }
        
        setScaleState(currentScale)
        setStagePosState(currentPos)
        
        if (progress < 1) {
          requestAnimationFrame(animate)
        } else {
          syncToWASM(targetScale, { x: targetX, y: targetY })
        }
      }
      
      animate()
    },
    [scale, stagePos, syncToWASM]
  )

  const zoomToFit = useCallback(
    (bounds: { x: number; y: number; width: number; height: number }, padding: number = 100, duration: number = 500) => {
      // Get viewport dimensions (assume 800x600 as default, will be updated by Canvas)
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      
      // Calculate scale to fit bounds in viewport with padding
      const scaleX = (viewportWidth - padding * 2) / bounds.width
      const scaleY = (viewportHeight - padding * 2) / bounds.height
      const targetScale = Math.min(scaleX, scaleY, 10) // Don't exceed max zoom
      
      // Calculate position to center the bounds
      const targetX = viewportWidth / 2 - (bounds.x + bounds.width / 2) * targetScale
      const targetY = viewportHeight / 2 - (bounds.y + bounds.height / 2) * targetScale
      
      animateToPosition(targetX, targetY, targetScale, duration)
    },
    [animateToPosition]
  )

  const controls: CameraControls = {
    scale,
    stagePos,
    setScale,
    setStagePos,
    zoom,
    zoomTo,
    pan,
    resetView,
    animateToPosition,
    zoomToFit,
  }

  return <CameraContext.Provider value={controls}>{children}</CameraContext.Provider>
}

export function useCamera(): CameraControls {
  const context = useContext(CameraContext)
  if (!context) {
    throw new Error('useCamera must be used within CameraProvider')
  }
  return context
}
