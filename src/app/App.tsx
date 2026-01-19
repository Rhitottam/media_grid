import { Canvas } from '@/components/Canvas';
import { Stats } from '@/components/Stats';
import { Toolbar } from '@/components/Toolbar';
import type { ToolType } from '@/types/tools';
import type { WASMExports } from '@/types/wasm';
import { useCallback, useEffect, useRef, useState } from 'react';

export function App() {
  const [wasm, setWasm] = useState<WASMExports | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({ visible: 0, total: 0, fps: 0 });
  const [gridSnap, setGridSnap] = useState(true);
  const [gridSize, setGridSize] = useState(20);
  const [activeTool, setActiveTool] = useState<ToolType>('select');
  
  // Track previous stats to avoid unnecessary re-renders
  const prevStatsRef = useRef({ visible: 0, total: 0, fps: 0 });

  // Load WASM module
  useEffect(() => {
    const loadWasm = async () => {
      try {
        const wasmModule = await import('@wasm/optimized.js') as unknown as WASMExports;
        setWasm(wasmModule);
        setLoading(false);
      } catch (e) {
        console.error('Failed to load WASM:', e);
        setError('Failed to load WASM module');
        setLoading(false);
      }
    };
    loadWasm();
  }, []);

  // Handle grid snap changes
  useEffect(() => {
    if (wasm) {
      wasm.setGridSnap(gridSnap);
    }
  }, [wasm, gridSnap]);

  // Handle grid size changes
  useEffect(() => {
    if (wasm) {
      wasm.setGridSize(gridSize);
    }
  }, [wasm, gridSize]);

  const handleStatsUpdate = useCallback((visible: number, total: number, fps: number) => {
    const prev = prevStatsRef.current;
    // Only update state if values actually changed
    if (prev.visible !== visible || prev.total !== total || prev.fps !== fps) {
      prevStatsRef.current = { visible, total, fps };
      setStats({ visible, total, fps });
    }
  }, []);

  const handleAddImage = useCallback(() => {
    if ((window as any).cloudGridAddImage) {
      (window as any).cloudGridAddImage();
    }
  }, []);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <div className="text-foreground text-lg">Loading CloudGrid...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <div className="text-destructive text-lg">{error}</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header with Toolbar and Stats as siblings */}
      <div className="flex items-center gap-3 px-4 py-3 bg-card border-b border-border shrink-0">
        <Toolbar
          wasm={wasm}
          gridSnap={gridSnap}
          gridSize={gridSize}
          activeTool={activeTool}
          onToolChange={setActiveTool}
          onGridSnapChange={setGridSnap}
          onGridSizeChange={setGridSize}
          onAddImage={handleAddImage}
        />
        <div className="ml-auto">
          <Stats visible={stats.visible} total={stats.total} fps={stats.fps} />
        </div>
      </div>
      <Canvas 
        wasm={wasm} 
        activeTool={activeTool}
        gridSize={gridSize}
        onStatsUpdate={handleStatsUpdate}
      />
    </div>
  );
}
