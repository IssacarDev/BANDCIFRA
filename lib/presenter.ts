/**
 * Modo apresentação: máquina de estados do pedal de 3 botões.
 * Lógica pura (sem React) para ser testada no selftest.
 */
export type PresentMode = 1 | 2 | 3 | 4 | 5;
export type PedalButton = 'left' | 'middle' | 'middleHold' | 'right' | 'rightHold';

export const MODE_NAMES: Record<PresentMode, string> = {
  1: 'Cifra',
  2: 'Tonalidade',
  3: 'Simplificar',
  4: 'Tamanho da fonte',
  5: 'Músicas',
};

export const MODE_SHORT: Record<PresentMode, string> = { 1: 'Cifra', 2: 'Tom', 3: 'Simples', 4: 'Fonte', 5: 'Músicas' };

export interface PedalState {
  mode: PresentMode;
  /** última vez que qualquer botão foi usado (ms) */
  lastActivity: number;
  /** último toque curto no botão do meio (ms), para o duplo toque */
  lastMiddle: number;
}

export type PedalAction =
  | { type: 'none' }
  | { type: 'page'; dir: 1 | -1 }
  | { type: 'transpose'; dir: 1 | -1 }
  | { type: 'simplify'; value: boolean }
  | { type: 'font'; dir: 1 | -1 }
  | { type: 'pick'; dir: 1 | -1 }
  | { type: 'pickConfirm' };

export const HOLD_MS = 700;
export const DOUBLE_TAP_MS = 350;
export const FONT_STEP = 2;
export const FONT_MIN = 12;
export const FONT_MAX = 56;

export const initialPedal = (now = 0): PedalState => ({ mode: 1, lastActivity: now, lastMiddle: -1e9 });

export function handlePedal(
  button: PedalButton,
  now: number,
  state: PedalState,
  idleMs: number,
): { state: PedalState; action: PedalAction } {
  const base = { ...state, lastActivity: now };

  if (button === 'middleHold') {
    return { state: { ...base, mode: 1 }, action: { type: 'none' } };
  }

  if (button === 'rightHold') {
    // na lista de músicas, segurar o botão que avança abre a música destacada
    return state.mode === 5
      ? { state: { ...base, mode: 1 }, action: { type: 'pickConfirm' } }
      : { state: base, action: { type: 'page', dir: 1 } };
  }

  if (button === 'middle') {
    // duplo toque rápido: volta ao modo 1 (alternativa para pedais que não "seguram")
    if (now - state.lastMiddle <= DOUBLE_TAP_MS) {
      return { state: { ...base, mode: 1, lastMiddle: -1e9 }, action: { type: 'none' } };
    }
    const next = (state.mode === 5 ? 1 : state.mode + 1) as PresentMode;
    return { state: { ...base, mode: next, lastMiddle: now }, action: { type: 'none' } };
  }

  const dir: 1 | -1 = button === 'right' ? 1 : -1;

  // ficou muito tempo fora do modo 1: este toque lateral volta ao modo 1 e já passa a cifra
  if (state.mode !== 1 && now - state.lastActivity > idleMs) {
    return { state: { ...base, mode: 1 }, action: { type: 'page', dir } };
  }

  switch (state.mode) {
    case 1:
      return { state: base, action: { type: 'page', dir } };
    case 2:
      return { state: base, action: { type: 'transpose', dir } };
    case 3:
      return { state: base, action: { type: 'simplify', value: dir === 1 } };
    case 4:
      return { state: base, action: { type: 'font', dir } };
    case 5:
      return { state: base, action: { type: 'pick', dir } };
  }
}

/** Texto curto do que cada lado faz no modo atual (para os botões na tela). */
export function actionLabels(mode: PresentMode): { left: string; right: string; hint: string } {
  switch (mode) {
    case 1:
      return { left: 'Voltar', right: 'Avançar', hint: 'Passa a cifra para o lado' };
    case 2:
      return { left: '− ½ tom', right: '+ ½ tom', hint: 'Muda a tonalidade' };
    case 3:
      return { left: 'Original', right: 'Simples', hint: 'Esquerda: cifra original · Direita: simplificada' };
    case 4:
      return { left: 'Menor', right: 'Maior', hint: 'Muda o tamanho da fonte' };
    case 5:
      return { left: 'Subir', right: 'Descer', hint: 'Esquerdo/direito escolhem a música · segure o direito para abrir' };
  }
}

export const clampFont = (n: number) => Math.min(FONT_MAX, Math.max(FONT_MIN, n));

/* ---------------- nomes de teclas e mensagens MIDI ---------------- */

export function keyLabel(code: string): string {
  const map: Record<string, string> = {
    ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓',
    Space: 'Espaço', Enter: 'Enter', PageUp: 'Page Up', PageDown: 'Page Down',
    Backspace: 'Backspace', Escape: 'Esc', Tab: 'Tab',
  };
  if (map[code]) return map[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return code;
}

/** Assinatura de uma mensagem MIDI que representa um "aperto" (ou null se for soltar/irrelevante). */
export function midiPress(data: ArrayLike<number>): string | null {
  const status = data[0] ?? 0;
  const type = status & 0xf0;
  const ch = status & 0x0f;
  const d1 = data[1] ?? 0;
  const d2 = data[2] ?? 0;
  if (type === 0x90 && d2 > 0) return `note:${ch}:${d1}`;
  if (type === 0xb0 && d2 >= 64) return `cc:${ch}:${d1}`;
  if (type === 0xc0) return `pc:${ch}:${d1}`;
  return null;
}

/** Assinatura de uma mensagem MIDI que representa "soltar" (para medir o segurar). */
export function midiRelease(data: ArrayLike<number>): string | null {
  const status = data[0] ?? 0;
  const type = status & 0xf0;
  const ch = status & 0x0f;
  const d1 = data[1] ?? 0;
  const d2 = data[2] ?? 0;
  if (type === 0x80 || (type === 0x90 && d2 === 0)) return `note:${ch}:${d1}`;
  if (type === 0xb0 && d2 < 64) return `cc:${ch}:${d1}`;
  return null;
}

export function midiLabel(sig?: string): string {
  if (!sig) return '—';
  const [t, ch, n] = sig.split(':');
  const name = t === 'note' ? 'Nota' : t === 'cc' ? 'Controle' : 'Programa';
  return `${name} ${n} (canal ${Number(ch) + 1})`;
}
