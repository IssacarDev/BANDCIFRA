/**
 * Dicionário de acordes de violão/guitarra.
 * Retorna as casas por corda (da 6ª/Mi grave para a 1ª/Mi agudo): -1 = muda, 0 = solta.
 * Acordes abertos comuns vêm de uma tabela; os demais são gerados por pestana
 * (formas móveis de Mi e de Lá).
 */
import { NOTE_INDEX, parseChord } from './chords';

type Quality = 'maj' | 'm' | '7' | 'm7' | 'maj7' | 'sus4' | 'sus2' | 'dim';

function qualityOf(suffix: string): Quality {
  if (/^(dim|º|°)/.test(suffix)) return 'dim';
  if (/sus2/.test(suffix)) return 'sus2';
  if (/sus|^4/.test(suffix)) return 'sus4';
  const minor = /^(?:m(?!aj)|min|-|ø)/.test(suffix);
  if (minor) return /7/.test(suffix) ? 'm7' : 'm';
  if (/7M|maj7|M7|maj9|7\+/.test(suffix)) return 'maj7';
  if (/7/.test(suffix)) return '7';
  return 'maj';
}

// chave: `${pitchClass}:${qualidade}`
const OPEN: Record<string, number[]> = {
  '0:maj': [-1, 3, 2, 0, 1, 0],
  '0:7': [-1, 3, 2, 3, 1, 0],
  '0:maj7': [-1, 3, 2, 0, 0, 0],
  '2:maj': [-1, -1, 0, 2, 3, 2],
  '2:m': [-1, -1, 0, 2, 3, 1],
  '2:7': [-1, -1, 0, 2, 1, 2],
  '2:m7': [-1, -1, 0, 2, 1, 1],
  '2:maj7': [-1, -1, 0, 2, 2, 2],
  '2:sus4': [-1, -1, 0, 2, 3, 3],
  '2:sus2': [-1, -1, 0, 2, 3, 0],
  '7:maj': [3, 2, 0, 0, 0, 3],
  '7:7': [3, 2, 0, 0, 0, 1],
  '7:maj7': [3, 2, 0, 0, 0, 2],
  '5:maj7': [-1, -1, 3, 2, 1, 0],
};

const E_SHAPE: Partial<Record<Quality, number[]>> = {
  maj: [0, 2, 2, 1, 0, 0],
  m: [0, 2, 2, 0, 0, 0],
  '7': [0, 2, 0, 1, 0, 0],
  m7: [0, 2, 0, 0, 0, 0],
  maj7: [0, 2, 1, 1, 0, 0],
  sus4: [0, 2, 2, 2, 0, 0],
};

const A_SHAPE: Partial<Record<Quality, number[]>> = {
  maj: [-1, 0, 2, 2, 2, 0],
  m: [-1, 0, 2, 2, 1, 0],
  '7': [-1, 0, 2, 0, 2, 0],
  m7: [-1, 0, 2, 0, 1, 0],
  maj7: [-1, 0, 2, 1, 2, 0],
  sus4: [-1, 0, 2, 2, 3, 0],
  sus2: [-1, 0, 2, 2, 0, 0],
  dim: [-1, 0, 1, 2, 1, -1],
};

function shift(shape: number[], base: number): number[] {
  return shape.map((f) => (f < 0 ? -1 : f + base));
}

export function getChordShape(chord: string): number[] | null {
  const p = parseChord(chord);
  if (!p) return null;
  const pc = NOTE_INDEX[p.root];
  if (pc === undefined) return null;
  const q = qualityOf(p.suffix);

  const open = OPEN[`${pc}:${q}`];
  if (open) return open;

  const candidates: number[][] = [];
  const e = E_SHAPE[q];
  if (e) candidates.push(shift(e, (pc - 4 + 12) % 12));
  const a = A_SHAPE[q];
  if (a) candidates.push(shift(a, (pc - 9 + 12) % 12));
  if (!candidates.length) return null;

  const lowest = (s: number[]) => Math.min(...s.filter((f) => f > 0), 99);
  candidates.sort((x, y) => lowest(x) - lowest(y));
  return candidates[0];
}
