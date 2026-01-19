import { memo } from 'react';

interface StatsProps {
  visible: number;
  total: number;
  fps: number;
}

export const Stats = memo(function Stats({ visible, total, fps }: StatsProps) {
  return (
    <div className="flex items-center gap-4 text-sm text-muted-foreground">
      <span>
        Visible: <span className="text-accent font-medium">{visible}</span>
      </span>
      <span className="text-border">|</span>
      <span>
        Total: <span className="text-accent font-medium">{total}</span>
      </span>
      <span className="text-border">|</span>
      <span>
        FPS: <span className="text-accent font-medium">{fps}</span>
      </span>
    </div>
  );
});
