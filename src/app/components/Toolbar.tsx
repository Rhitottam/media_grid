import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ToolType } from '@/types/tools';
import type { WASMExports } from '@/types/wasm';
import { Grid3X3, Hand, ImagePlus, MousePointer2, Redo2, Undo2 } from 'lucide-react';
import { memo } from 'react';

interface ToolbarProps {
  wasm: WASMExports | null;
  gridSnap: boolean;
  gridSize: number;
  activeTool: ToolType;
  onToolChange: (tool: ToolType) => void;
  onGridSnapChange: (enabled: boolean) => void;
  onGridSizeChange: (size: number) => void;
  onAddImage: () => void;
}

export const Toolbar = memo(function Toolbar({
  wasm,
  gridSnap,
  gridSize,
  activeTool,
  onToolChange,
  onGridSnapChange,
  onGridSizeChange,
  onAddImage,
}: ToolbarProps) {
  const handleUndo = () => {
    wasm?.undo();
  };

  const handleRedo = () => {
    wasm?.redo();
  };

  return (
    <>
      {/* Tool Selection */}
      <div className="flex items-center gap-1 bg-secondary/50 rounded-md p-1">
        <Button
          variant={activeTool === 'select' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => onToolChange('select')}
          className="h-8 w-8 p-0"
          title="Select Tool (V)"
        >
          <MousePointer2 className="h-4 w-4" />
        </Button>
        <Button
          variant={activeTool === 'pan' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => onToolChange('pan')}
          className="h-8 w-8 p-0"
          title="Pan Tool (H)"
        >
          <Hand className="h-4 w-4" />
        </Button>
      </div>

      <div className="h-6 w-px bg-border mx-1" />

      <Button onClick={onAddImage} size="sm">
        <ImagePlus className="h-4 w-4" />
        Add Image
      </Button>
      
      <Button variant="secondary" size="sm" onClick={handleUndo}>
        <Undo2 className="h-4 w-4" />
        Undo
      </Button>
      
      <Button variant="secondary" size="sm" onClick={handleRedo}>
        <Redo2 className="h-4 w-4" />
        Redo
      </Button>
      
      <div className="h-6 w-px bg-border mx-1" />
      
      <div className="flex items-center gap-2 select-none">
        <Checkbox
          id="gridSnap"
          checked={gridSnap}
          onCheckedChange={(checked) => onGridSnapChange(checked === true)}
        />
        <label 
          htmlFor="gridSnap" 
          className="flex items-center gap-2 cursor-pointer text-sm text-foreground"
        >
          <Grid3X3 className="h-4 w-4" />
          <span>Grid Snap</span>
        </label>
      </div>
      
      <div className="flex items-center gap-2">
        <Label htmlFor="gridSize" className="text-sm text-foreground whitespace-nowrap">
          Grid Size:
        </Label>
        <Input
          id="gridSize"
          type="number"
          value={gridSize}
          onChange={(e) => onGridSizeChange(parseInt(e.target.value) || 20)}
          min={5}
          max={100}
          className="w-16 h-8"
        />
      </div>
    </>
  );
});
