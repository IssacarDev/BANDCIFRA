/**
 * Operações de edição de blocos. O editor trabalha com "rascunhos" (`DraftBlock`)
 * em que a letra+cifra de cada bloco é um texto editável (cifra sobre letra).
 */
import type { SectionType, Song, SongBlock } from '@/types/song';
import { linesToText, parseLines, SECTION_LABELS } from './parser';
import { uid } from './utils';

export interface DraftBlock {
  id: string;
  type: SectionType;
  label: string;
  text: string;
}

export const SECTION_TYPES: SectionType[] = [
  'intro', 'verse', 'pre-chorus', 'chorus', 'bridge', 'solo', 'outro',
];

export const toDrafts = (song: Pick<Song, 'blocks'>): DraftBlock[] =>
  song.blocks.map((b) => ({ id: b.id, type: b.type, label: b.label, text: linesToText(b.lines) }));

export const fromDrafts = (drafts: DraftBlock[]): SongBlock[] =>
  drafts.map((d) => ({
    id: d.id,
    type: d.type,
    label: d.label || SECTION_LABELS[d.type],
    lines: parseLines(d.text.split('\n')),
  }));

export function moveDraft(list: DraftBlock[], from: number, to: number): DraftBlock[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** Duplica o bloco logo após o original (mesmos acordes, novo id). */
export function duplicateDraft(list: DraftBlock[], index: number): DraftBlock[] {
  const next = [...list];
  next.splice(index + 1, 0, { ...list[index], id: uid() });
  return next;
}

/** Junta o bloco com o seguinte (dir = 1) ou anterior (dir = -1). */
export function mergeDraft(list: DraftBlock[], index: number, dir: 1 | -1): DraftBlock[] {
  const other = index + dir;
  if (other < 0 || other >= list.length) return list;
  const [a, b] = dir === 1 ? [list[index], list[other]] : [list[other], list[index]];
  const merged: DraftBlock = { ...a, text: [a.text, b.text].filter(Boolean).join('\n') };
  const next = list.filter((_, i) => i !== index && i !== other);
  next.splice(Math.min(index, other), 0, merged);
  return next;
}

export function newDraft(type: SectionType = 'verse'): DraftBlock {
  return { id: uid(), type, label: SECTION_LABELS[type], text: '' };
}
