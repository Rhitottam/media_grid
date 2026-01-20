/**
 * Hook to manage and sync camera state (zoom, position) between WASM and React
 */

import { useEffect, useState } from 'react'
import type { WASMExports } from '../utils/wasmLoader'

export interface CameraState {
  zoom: number
  x: number
  y: number
}

// Global camera state that can be updated from anywhere
let globalCameraState: CameraState = { zoom: 1, x: 0, y: 0 }
const listeners = new Set<(state: CameraState) => void>()

export function updateCameraState(wasm: WASMExports | CameraState) {
  let newState: CameraState
  
  if ('getCameraZoom' in wasm) {
    // WASM instance - read from it
    newState = {
      zoom: wasm.getCameraZoom(),
      x: wasm.getCameraX(),
      y: wasm.getCameraY(),
    }
  } else {
    // Direct camera state
    newState = wasm
  }
  
  // Only update if values actually changed
  if (
    newState.zoom !== globalCameraState.zoom ||
    newState.x !== globalCameraState.x ||
    newState.y !== globalCameraState.y
  ) {
    globalCameraState = newState
    listeners.forEach((listener) => listener(newState))
  }
}

export function useCameraState(wasm: WASMExports | null) {
  const [cameraState, setCameraState] = useState<CameraState>(globalCameraState)

  useEffect(() => {
    if (!wasm) return

    // Initial state
    updateCameraState(wasm)

    // Subscribe to changes
    listeners.add(setCameraState)

    return () => {
      listeners.delete(setCameraState)
    }
  }, [wasm])

  return cameraState
}
