'use client';
import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Minus, Pause, Play, Plus, Square } from 'lucide-react';
import { createTapTempo } from '@/hooks/useMetronome';
import { cn } from '@/lib/utils';

interface Props {
  showScroll: boolean;
  scrolling: boolean;
  speed: number;
  onToggleScroll: () => void;
  onSpeed: (v: number) => void;
  bpm: number;
  beat: number;
  beatsPerBar: number;
  metroOn: boolean;
  onBpm: (v: number) => void;
  onToggleMetro: () => void;
}

const step =
  'flex h-8 w-8 items-center justify-center rounded-full text-muted transition hover:bg-accent/15 hover:text-ink active:scale-90';

function PlayBtn({ on, onClick, label, stop }: { on: boolean; onClick: () => void; label: string; stop?: boolean }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={cn(
        'flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition active:scale-95',
        on ? 'bg-accent text-accentfg shadow-soft' : 'bg-accent/15 text-accent hover:bg-accent/25',
      )}
    >
      {on ? (
        stop ? <Square size={16} fill="currentColor" /> : <Pause size={20} fill="currentColor" />
      ) : (
        <Play size={20} fill="currentColor" className="ml-0.5" />
      )}
    </button>
  );
}

/** Barra flutuante inferior: rolagem automática + metrônomo, sempre à mão. */
export default function Dock(p: Props) {
  const [open, setOpen] = useState(true);
  const tap = useMemo(() => createTapTempo(), []);
  const clamp = (v: number) => Math.min(300, Math.max(30, v));

  // em telas pequenas começa recolhida para não cobrir a cifra
  useEffect(() => {
    if (window.innerWidth < 640) setOpen(false);
  }, []);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Rolagem e metrônomo"
        title="Rolagem e metrônomo"
        className="no-print fixed bottom-4 right-4 z-30 inline-flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accentfg shadow-lift transition active:scale-95 sm:w-auto sm:gap-2 sm:px-5 sm:text-sm sm:font-semibold"
      >
        <Play size={20} fill="currentColor" className="ml-0.5 sm:ml-0" /> <span className="hidden sm:inline">Rolagem e metrônomo</span>
      </button>
    );
  }

  return (
    <div className="no-print fixed bottom-4 left-1/2 z-30 flex max-w-[calc(100vw-1rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-x-4 gap-y-2 rounded-[2rem] border border-line bg-card px-4 py-2.5 shadow-lift">
      {p.showScroll && (
        <div className="flex items-center gap-2.5">
          <PlayBtn on={p.scrolling} onClick={p.onToggleScroll} label={p.scrolling ? 'Pausar rolagem' : 'Iniciar rolagem'} />
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">Rolagem</div>
            <div className="flex items-center">
              <button onClick={() => p.onSpeed(p.speed - 1)} aria-label="Mais devagar" className={step}><Minus size={14} /></button>
              <span className="w-12 text-center text-sm font-bold tabular-nums">vel. {p.speed}</span>
              <button onClick={() => p.onSpeed(p.speed + 1)} aria-label="Mais rápido" className={step}><Plus size={14} /></button>
            </div>
          </div>
        </div>
      )}

      {p.showScroll && <div className="hidden h-9 w-px bg-line sm:block" />}

      <div className="flex items-center gap-2.5">
        <PlayBtn on={p.metroOn} stop onClick={p.onToggleMetro} label={p.metroOn ? 'Parar metrônomo' : 'Iniciar metrônomo'} />
        <div>
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
            Metrônomo
            {p.metroOn && (
              <span className="flex gap-1">
                {Array.from({ length: p.beatsPerBar }).map((_, i) => (
                  <span key={i} className={cn('h-1.5 w-1.5 rounded-full bg-line', p.beat === i + 1 && (i === 0 ? '!bg-chord' : '!bg-accent'))} />
                ))}
              </span>
            )}
          </div>
          <div className="flex items-center">
            <button onClick={() => p.onBpm(clamp(p.bpm - 1))} aria-label="Diminuir BPM" className={step}><Minus size={14} /></button>
            <input
              type="number"
              value={p.bpm}
              min={30}
              max={300}
              onChange={(e) => p.onBpm(clamp(Number(e.target.value) || 30))}
              className="w-11 bg-transparent text-center text-sm font-bold tabular-nums outline-none [appearance:textfield] focus:text-accent [&::-webkit-inner-spin-button]:appearance-none"
              aria-label="BPM"
            />
            <span className="mr-0.5 text-xs text-muted">BPM</span>
            <button onClick={() => p.onBpm(clamp(p.bpm + 1))} aria-label="Aumentar BPM" className={step}><Plus size={14} /></button>
            <button
              onClick={() => { const v = tap(); if (v) p.onBpm(v); }}
              title="Toque no ritmo para descobrir o BPM"
              className="ml-1.5 rounded-full bg-accent/15 px-3.5 py-1.5 text-sm font-bold text-accent transition hover:bg-accent/25 active:scale-95"
            >
              Tap
            </button>
          </div>
        </div>
      </div>

      <button onClick={() => setOpen(false)} aria-label="Esconder barra" className="rounded-full p-1.5 text-muted hover:bg-accent/10 hover:text-ink">
        <ChevronDown size={18} />
      </button>
    </div>
  );
}
