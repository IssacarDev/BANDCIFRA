/**
 * Mecânica harmônica: parsing de acordes, transposição, capotraste e simplificação.
 *
 * Convenção do app:
 *  - Os acordes em `song.blocks` ficam gravados no tom `song.originalKey` (som real).
 *  - `song.currentKey` define a transposição (diferença para o tom original).
 *  - `song.capo` define a casa do capotraste: o formato tocado = som real − capo.
 */
import type { Song } from '@/types/song';

const SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

export const NOTE_INDEX: Record<string, number> = {
  C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, Fb: 4, 'E#': 5, F: 5,
  'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11, Cb: 11, 'B#': 0,
};

/**
 * Acorde válido (notação brasileira e americana):
 * C, Am, F#m7, C7M(9), Bm7(b5), G/B, D4, Csus4, Cadd9, Cº, E7(b9)...
 */
export const CHORD_RE =
  /^([A-G][#b]?)((?:maj|min|dim|aug|sus|add|m|M|º|°|ø|\+|-|\d+|[#b]\d+|\([^)\s]*\))*)(?:\/([A-G][#b]?))?$/;

export interface ParsedChord {
  root: string;
  suffix: string;
  bass?: string;
}

export function parseChord(chord: string): ParsedChord | null {
  const m = CHORD_RE.exec(chord);
  if (!m) return null;
  return { root: m[1], suffix: m[2] ?? '', bass: m[3] };
}

export const isChord = (s: string) => CHORD_RE.test(s);

/* ------------------------------------------------------------------ */
/* Notas e tons                                                        */
/* ------------------------------------------------------------------ */

export function transposeNote(note: string, semitones: number, flats = false): string {
  const i = NOTE_INDEX[note];
  if (i === undefined) return note;
  return (flats ? FLAT : SHARP)[(((i + semitones) % 12) + 12) % 12];
}

/** Transpõe um acorde por N semitons respeitando enarmonia (#/b). */
export function transposeChord(chord: string, semitones: number, flats = false): string {
  if (!semitones) return chord;
  const p = parseChord(chord);
  if (!p) return chord;
  const bass = p.bass ? '/' + transposeNote(p.bass, semitones, flats) : '';
  return transposeNote(p.root, semitones, flats) + p.suffix + bass;
}

export function parseKey(key: string): { root: string; minor: boolean } {
  const m = /^([A-G][#b]?)(m(?!aj)|min)?/.exec(key.trim());
  if (!m) return { root: 'C', minor: false };
  return { root: m[1], minor: !!m[2] };
}

const MAJOR_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const MINOR_NAMES = ['Cm', 'C#m', 'Dm', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'Bbm', 'Bm'];

/** Transpõe o nome de um tom ("G", "F#m") escolhendo a grafia mais comum. */
export function transposeKey(key: string, semitones: number): string {
  const { root, minor } = parseKey(key);
  const i = ((((NOTE_INDEX[root] ?? 0) + semitones) % 12) + 12) % 12;
  return (minor ? MINOR_NAMES : MAJOR_NAMES)[i];
}

/** Tons que, por convenção, usam bemóis. */
export function keyUsesFlats(key: string): boolean {
  const { root, minor } = parseKey(key);
  if (root.includes('b')) return true;
  if (root.includes('#')) return false;
  return minor ? ['D', 'G', 'C', 'F'].includes(root) : root === 'F';
}

/** Diferença em semitons (−5..+6) entre dois tons. */
export function semitoneDiff(from: string, to: string): number {
  const a = NOTE_INDEX[parseKey(from).root] ?? 0;
  const b = NOTE_INDEX[parseKey(to).root] ?? 0;
  const d = (((b - a) % 12) + 12) % 12;
  return d > 6 ? d - 12 : d;
}

/* ------------------------------------------------------------------ */
/* Simplificação                                                       */
/* ------------------------------------------------------------------ */

/**
 * Reduz extensões para o acorde básico, preservando o que é essencial:
 *  C7M(9) -> C | F#m7 -> F#m | Bm7(b5) -> Bm | Csus4 -> C | Cº -> Cdim | G/B -> G
 *  Sétima DOMINANTE é mantida (função harmônica): A7 -> A7 | A7(b9) -> A7 | A9 -> A7 | D7(4) -> D7
 */
export function simplifyChord(chord: string, opts: { keepBass?: boolean } = {}): string {
  const p = parseChord(chord);
  if (!p) return chord;
  const s = p.suffix;
  let quality = '';
  if (/^(dim|º|°)/.test(s)) quality = 'dim';
  else if (/^(?:m(?!aj)|min|-|ø)/.test(s)) quality = 'm';
  else if (!/maj|M|\+/.test(s) && /^(?:7|9|11|13)/.test(s)) quality = '7';
  const bass = opts.keepBass && p.bass ? '/' + p.bass : '';
  return p.root + quality + bass;
}

/* ------------------------------------------------------------------ */
/* Contexto de exibição (transposição + capo + simplificação)          */
/* ------------------------------------------------------------------ */

export interface ChordContext {
  steps: number;
  capo: number;
  simplified: boolean;
  showSounding: boolean;
  soundFlats: boolean;
  shapeFlats: boolean;
}

export interface SongKeys {
  original: string;
  sounding: string;
  shape: string;
  steps: number;
}

export function getKeys(song: Pick<Song, 'originalKey' | 'currentKey' | 'capo'>): SongKeys {
  const steps = semitoneDiff(song.originalKey, song.currentKey);
  const sounding = transposeKey(song.originalKey, steps);
  return {
    original: song.originalKey,
    sounding,
    shape: transposeKey(sounding, -song.capo),
    steps,
  };
}

export function buildContext(
  song: Pick<Song, 'originalKey' | 'currentKey' | 'capo'>,
  opts: { simplified: boolean; showSounding: boolean },
): ChordContext {
  const keys = getKeys(song);
  return {
    steps: keys.steps,
    capo: song.capo,
    simplified: opts.simplified,
    showSounding: opts.showSounding,
    soundFlats: keyUsesFlats(keys.sounding),
    shapeFlats: keyUsesFlats(keys.shape),
  };
}

/**
 * `label` é o que aparece na cifra; `shape` é o acorde que os dedos formam
 * (usado no diagrama), já descontando o capotraste.
 */
export function resolveChord(chord: string, ctx: ChordContext): { label: string; shape: string } {
  let sounding = transposeChord(chord, ctx.steps, ctx.soundFlats);
  if (ctx.simplified) sounding = simplifyChord(sounding);
  const shape = ctx.capo ? transposeChord(sounding, -ctx.capo, ctx.shapeFlats) : sounding;
  return { label: ctx.showSounding ? sounding : shape, shape };
}

/* ------------------------------------------------------------------ */
/* Tipo do acorde (para colorir)                                       */
/* ------------------------------------------------------------------ */

export type ChordKind = 'maj' | 'min' | 'dom' | 'other';

/** maior (inclui 7M/add9) · menor (inclui m7) · dominante (A7, A9...) · outros (dim, sus, aug). */
export function chordKind(chord: string): ChordKind {
  const p = parseChord(chord);
  if (!p) return 'other';
  const s = p.suffix;
  if (/^(dim|º|°|aug|\+)|sus/.test(s)) return 'other';
  if (/^(?:m(?!aj)|min|-|ø)/.test(s)) return 'min';
  if (!/maj|M/.test(s) && /^(?:7|9|11|13)/.test(s)) return 'dom';
  return 'maj';
}
