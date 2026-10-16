'use client';
import { useEffect, useRef, useState } from 'react';

/**
 * Metrônomo visual (silencioso). Emite um `tick` incremental a cada tempo;
 * `beat` é a posição no compasso (1..beatsPerBar), 0 quando parado.
 */
export function useMetronome(bpm: number, beatsPerBar: number, running: boolean) {
  const [tick, setTick] = useState(0);
  const bpmRef = useRef(bpm);
  bpmRef.current = bpm;

  useEffect(() => {
    if (!running) {
      setTick(0);
      return;
    }
    let raf = 0;
    let n = 0;
    let next = performance.now();
    const loop = (now: number) => {
      if (now >= next) {
        n++;
        setTick(n);
        const interval = 60000 / Math.max(20, bpmRef.current);
        next += interval;
        if (now > next) next = now + interval; // aba ficou em segundo plano
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running]);

  const beat = tick === 0 ? 0 : ((tick - 1) % Math.max(1, beatsPerBar)) + 1;
  return { tick, beat };
}

/** Tap tempo: média dos últimos toques (reinicia após 2,5 s de pausa). */
export function createTapTempo() {
  let taps: number[] = [];
  return (now = performance.now()): number | null => {
    if (taps.length && now - taps[taps.length - 1] > 2500) taps = [];
    taps.push(now);
    taps = taps.slice(-8);
    if (taps.length < 2) return null;
    const intervals = taps.slice(1).map((t, i) => t - taps[i]);
    const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    return Math.min(300, Math.max(30, Math.round(60000 / avg)));
  };
}
