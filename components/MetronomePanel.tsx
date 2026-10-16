'use client';
import { cn } from '@/lib/utils';

/** Barra de pulso discreta no topo da tela (sem som). */
export function PulseBar({ tick, beat }: { tick: number; beat: number }) {
  if (!tick) return null;
  return (
    <div className="no-print pointer-events-none fixed inset-x-0 top-0 z-40 h-1.5">
      <div key={tick} className={cn('pulse-bar h-full w-full', beat === 1 && 'pulse-accent')} />
    </div>
  );
}
