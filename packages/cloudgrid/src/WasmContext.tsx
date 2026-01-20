/**
 * WasmContext - Provides WASM instance to all child components
 */

import { createContext, useContext, type ReactNode } from 'react';
import type { WASMExports } from './utils/wasmLoader';

const WasmContext = createContext<WASMExports | null>(null);

export interface WasmProviderProps {
  wasm: WASMExports | null;
  children: ReactNode;
}

export function WasmProvider({ wasm, children }: WasmProviderProps) {
  return <WasmContext.Provider value={wasm}>{children}</WasmContext.Provider>;
}

/**
 * Hook to access WASM instance from anywhere inside CloudGrid
 * @throws Error if used outside CloudGrid component
 */
export function useWasm(): WASMExports | null {
  return useContext(WasmContext);
}

/**
 * Hook that throws if WASM is not available
 * Use this when WASM is required
 */
export function useWasmRequired(): WASMExports {
  const wasm = useContext(WasmContext);
  if (!wasm) {
    throw new Error('useWasmRequired must be used inside CloudGrid and WASM must be initialized');
  }
  return wasm;
}
