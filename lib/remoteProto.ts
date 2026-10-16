import type { PresentMode } from './presenter';

export type Side = 'left' | 'middle' | 'right';

/** Estado que a apresentação envia para o controle. */
export interface RemoteState {
  songId: string;
  title: string;
  artist: string;
  key: string;
  capo: number;
  simplified: boolean;
  fontSize: number;
  mode: PresentMode;
  page: number;
  pages: number;
  pick: number;
  hasPrev: boolean;
  hasNext: boolean;
  songs: { id: string; title: string; artist: string; key: string }[];
}

/** Comandos que o controle envia para a apresentação. */
export type RemoteCmd =
  | { k: 'press'; side: Side; phase: 'down' | 'up' }
  | { k: 'transpose'; dir: 1 | -1 }
  | { k: 'simplify' }
  | { k: 'font'; dir: 1 | -1 }
  | { k: 'mode'; mode: PresentMode }
  | { k: 'song'; id: string }
  | { k: 'nextSong' }
  | { k: 'prevSong' }
  | { k: 'page'; dir: 1 | -1 }
  | { k: 'exit' };

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function newCode(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

const KEY = 'cifra-app:remote-code';
/** Código da sala deste aparelho (fica salvo para o QR não mudar a cada música). */
export function loadCode(): string {
  try {
    const c = localStorage.getItem(KEY);
    if (c && /^[A-Z0-9]{4,12}$/.test(c)) return c;
    const n = newCode();
    localStorage.setItem(KEY, n);
    return n;
  } catch {
    return newCode();
  }
}
