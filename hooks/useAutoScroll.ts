'use client';
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

/** px/s para a velocidade 1..10 */
export const pxPerSecond = (speed: number) => 6 + speed * 7;

/**
 * Rolagem automática ultra-suave com requestAnimationFrame.
 * Mantém a posição fracionária num acumulador (scrollTop é arredondado pelo
 * navegador) e respeita rolagem manual do usuário.
 */
export function useAutoScroll(
  ref: RefObject<HTMLElement | null>,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeedState] = useState(3);
  const speedRef = useRef(speed);
  speedRef.current = speed;

  useEffect(() => {
    if (!playing || !enabled) return;
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    let last = performance.now();
    let pos = el.scrollTop;

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      if (Math.abs(el.scrollTop - pos) > 2) pos = el.scrollTop; // usuário rolou manualmente
      pos += pxPerSecond(speedRef.current) * dt;
      const max = el.scrollHeight - el.clientHeight;
      if (pos >= max) {
        el.scrollTop = max;
        setPlaying(false);
        return;
      }
      el.scrollTop = pos;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, enabled, ref]);

  useEffect(() => {
    if (!enabled) setPlaying(false);
  }, [enabled]);

  const toggle = useCallback(() => setPlaying((p) => !p), []);
  const setSpeed = useCallback((v: number) => setSpeedState(Math.min(10, Math.max(1, Math.round(v)))), []);
  const changeSpeed = useCallback(
    (d: number) => setSpeedState((s) => Math.min(10, Math.max(1, s + d))),
    [],
  );

  return { playing, speed, toggle, setSpeed, changeSpeed, setPlaying };
}
