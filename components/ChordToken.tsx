'use client';
import { createContext, useContext, useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import ChordDiagram from './ChordDiagram';
import { cn } from '@/lib/utils';
import type { ChordKind } from '@/lib/chords';

/** Desliga os diagramas ao passar o mouse (modo apresentação). */
export const InteractiveChords = createContext(true);

/** Acorde clicável: hover/clique abre o mini-diagrama (digitação) do acorde. */
export default function ChordToken({
  label,
  shape,
  capo,
  kind,
  colored = true,
  className,
  style,
}: {
  label: string;
  shape: string;
  capo: number;
  kind?: ChordKind;
  colored?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const interactive = useContext(InteractiveChords);

  /**
   * O diagrama abre na margem livre ao lado da cifra (direita, ou esquerda se faltar
   * espaço), na altura do acorde, para nunca cobrir a letra. Se a cifra ocupa a tela
   * toda (2 colunas), cai para baixo/cima do acorde.
   */
  const open = () => {
    const el = ref.current;
    const r = el?.getBoundingClientRect();
    if (!el || !r) return;
    const W = 140, H = 190, gap = 28;
    const vw = window.innerWidth, vh = window.innerHeight;
    const root = el.closest('.song-root')?.getBoundingClientRect();
    const clampTop = (t: number) => Math.min(Math.max(t, 8), vh - H - 8);

    if (root) {
      const rightRoom = vw - root.right;
      const leftRoom = root.left;
      if (rightRoom >= W + gap && rightRoom >= leftRoom) {
        return setPos({ left: root.right + gap, top: clampTop(r.top + r.height / 2 - H / 2) });
      }
      if (leftRoom >= W + gap) {
        return setPos({ left: root.left - W - gap, top: clampTop(r.top + r.height / 2 - H / 2) });
      }
    }
    // sem margem livre: abaixo (ou acima) do acorde
    const below = r.bottom + H + 12 <= vh;
    setPos({
      left: Math.min(Math.max(r.left + r.width / 2 - W / 2, 8), vw - W - 8),
      top: below ? r.bottom + 8 : Math.max(8, r.top - H - 8),
    });
  };

  useEffect(() => {
    if (!pos) return;
    const close = () => setPos(null);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('scroll', close, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [pos]);

  return (
    <>
      <button
        ref={ref}
        type="button"
        onMouseEnter={interactive ? open : undefined}
        onMouseLeave={interactive ? () => setPos(null) : undefined}
        onClick={interactive ? () => (pos ? setPos(null) : open()) : undefined}
        tabIndex={interactive ? undefined : -1}
        data-kind={colored ? kind : undefined}
        className={cn(!interactive && 'pointer-events-none', colored ? 'chord-chip font-bold' : 'font-bold leading-none text-chord hover:underline', className)}
        style={style}
      >
        {label}
      </button>
      {pos &&
        createPortal(
          <div
            className="pointer-events-none fixed z-50 rounded-xl border border-line bg-card p-1 shadow-lift"
            style={{ left: pos.left, top: pos.top }}
          >
            <ChordDiagram chord={shape} capo={capo} />
          </div>,
          document.body,
        )}
    </>
  );
}
