/**
 * Parser de cifras em texto (cifra sobre letra) -> estrutura `Song`.
 *
 * Usado por:
 *  - importador de PDF (texto reconstruído por `pdfParser.ts`)
 *  - importador de texto estilo Holyrics (colar letra / cifra)
 *  - editor de blocos (converte o texto do bloco em linhas e vice-versa)
 */
import type { ChordPosition, LyricLine, SectionType, Song, SongBlock } from '@/types/song';
import { isChord, parseChord, transposeChord, transposeKey, keyUsesFlats } from './chords';
import { uid } from './utils';

/* ------------------------------------------------------------------ */
/* Linhas de acorde x linhas de letra                                  */
/* ------------------------------------------------------------------ */

/** Marcadores que podem aparecer numa linha de acordes sem serem acordes. */
const IGNORABLE_RE =
  /^(?:\||\|\||:|-|–|—|\/|%|\(?\d+x\)?|\(?x\d+\)?|N\.?C\.?|\.{2,}|\(|\)|\[|\]|\*)$/i;

/** Linha de acordes = ≥75% dos tokens (ignorando marcadores) são acordes válidos. */
export function isChordLine(line: string): boolean {
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return false;
  let chords = 0;
  let others = 0;
  for (const t of tokens) {
    if (isChord(t)) chords++;
    else if (!IGNORABLE_RE.test(t)) others++;
  }
  return chords > 0 && chords / (chords + others) >= 0.75;
}

export function extractChords(line: string): ChordPosition[] {
  const out: ChordPosition[] = [];
  for (const m of line.matchAll(/\S+/g)) {
    if (isChord(m[0])) out.push({ chord: m[0], charIndex: m.index ?? 0 });
  }
  return out;
}

/** Converte linhas cruas (acorde em cima, letra embaixo) em `LyricLine[]`. */
export function parseLines(raw: string[]): LyricLine[] {
  const out: LyricLine[] = [];
  let i = 0;
  while (i < raw.length) {
    const l = raw[i];
    if (!l.trim()) {
      i++;
      continue;
    }
    if (isChordLine(l)) {
      const chords = extractChords(l);
      const next = raw[i + 1];
      if (next !== undefined && next.trim() && !isChordLine(next)) {
        out.push({ text: next.replace(/\s+$/, ''), chords });
        i += 2;
      } else {
        out.push({ text: '', chords }); // linha instrumental
        i++;
      }
    } else {
      out.push({ text: l.replace(/\s+$/, ''), chords: [] });
      i++;
    }
  }
  return out;
}

/** Inverso de `parseLines`: gera o texto "cifra sobre letra" de um bloco. */
export function linesToText(lines: LyricLine[]): string {
  const rows: string[] = [];
  for (const line of lines) {
    if (line.chords.length) {
      let out = '';
      for (const c of [...line.chords].sort((a, b) => a.charIndex - b.charIndex)) {
        const target = Math.max(c.charIndex, out ? out.length + 1 : 0);
        out = out.padEnd(target, ' ') + c.chord;
      }
      rows.push(out);
    }
    if (line.text !== '' || !line.chords.length) rows.push(line.text);
  }
  return rows.join('\n');
}

/* ------------------------------------------------------------------ */
/* Cabeçalhos de seção                                                 */
/* ------------------------------------------------------------------ */

export const SECTION_LABELS: Record<SectionType, string> = {
  intro: 'Intro',
  verse: 'Verso',
  'pre-chorus': 'Pré-Refrão',
  chorus: 'Refrão',
  bridge: 'Ponte',
  solo: 'Solo',
  outro: 'Final',
};

const SECTION_RULES: [RegExp, SectionType][] = [
  [/^pr[eé][\s-]*(refr[aã]o|coro)/i, 'pre-chorus'],
  [/^pre[\s-]*chorus/i, 'pre-chorus'],
  [/^(refr[aã]o|coro|chorus)/i, 'chorus'],
  [/^(intro(du[cç][aã]o)?)/i, 'intro'],
  [/^(verso|estrofe|verse|(primeira|segunda|terceira|quarta)\s+parte|parte)/i, 'verse'],
  [/^(ponte|bridge)/i, 'bridge'],
  [/^(solo|instrumental|interl[uú]dio|riff)/i, 'solo'],
  [/^(final|fim|outro|coda|encerramento)/i, 'outro'],
];

export function parseSectionHeader(line: string): { type: SectionType; label: string } | null {
  const t = line.trim();
  if (!t || t.length > 40) return null;
  const bracketed = /^[\[(*]\s*(.+?)\s*[\])*]\s*:?$/.exec(t);
  const colon = /^([^:]{1,30}):$/.exec(t);
  const inner = (bracketed?.[1] ?? colon?.[1] ?? t).replace(/\s+/g, ' ').trim();
  const explicit = !!(bracketed || colon);

  for (const [re, type] of SECTION_RULES) {
    if (!re.test(inner)) continue;
    // Sem colchetes/dois-pontos, só aceita se a linha inteira for "Palavra [número] [x2]"
    if (!explicit && !/^[^\d(]+?(\s+\d+)?(\s*\(?x\d+\)?)?$/i.test(inner)) continue;
    if (!explicit && inner.split(' ').length > 3) continue;
    const label = inner.charAt(0).toUpperCase() + inner.slice(1);
    return { type, label };
  }
  if (bracketed) {
    // [Tab], [Riff], [Dedilhado]... — bloco desconhecido
    return { type: 'verse', label: inner.charAt(0).toUpperCase() + inner.slice(1) };
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Parser principal                                                    */
/* ------------------------------------------------------------------ */

export interface ParseOptions {
  id?: string;
  title?: string;
  artist?: string;
  originalKey?: string;
  capo?: number;
  bpm?: number;
  /** Tenta detectar "Título / Artista" nas primeiras linhas (use para PDFs). */
  detectHeader?: boolean;
  /** Título de reserva (ex.: nome do arquivo). */
  titleHint?: string;
}

const NOISE_RE = /cifraclub|cifra club|^https?:\/\/|^www\.|^\s*\d+\s*(\/|de)\s*\d+\s*$/i;

export function parseCifraText(rawText: string, opts: ParseOptions = {}): Song {
  let lines = rawText
    .replace(/\r\n?/g, '\n')
    .replace(/\t/g, '    ')
    .split('\n')
    .map((l) => (NOISE_RE.test(l.trim()) ? '' : l));

  /* ---- metadados (Tom, Capotraste, Afinação, BPM) ---- */
  let key: string | undefined;
  let capo: number | undefined;
  let tuning: string | undefined;
  let bpm: number | undefined;
  lines = lines.map((l) => {
    const t = l.trim();
    if (!t || t.length > 80 || !/^(tom|key|capo|capotraste|afina|tuning|bpm|andamento|simplificada)/i.test(t)) return l;
    const k = /(?:tom|key)\s*:\s*([A-G][#b]?(?:m(?!aj)|min)?)(?![A-Za-z])/i.exec(t);
    if (k) key = k[1].charAt(0).toUpperCase() + k[1].slice(1);
    const c = /capo(?:traste)?[^\d\n]{0,20}(\d{1,2})/i.exec(t);
    if (c) capo = Number(c[1]);
    else if (/^(sem\s+)?capo(traste)?\s*:?\s*(sem|nenhum|no)?/i.test(t) && /sem|nenhum|no/i.test(t)) capo = 0;
    const tu = /(?:afina[cç][aã]o|tuning)\s*:\s*(.+?)(?:\s{2,}|$)/i.exec(t);
    if (tu) tuning = tu[1].trim();
    const b = /(?:bpm|andamento)\s*:\s*(\d{2,3})/i.exec(t);
    if (b) bpm = Number(b[1]);
    return '';
  });

  /* ---- título / artista no topo ---- */
  let title = opts.title;
  let artist = opts.artist;
  if (opts.detectHeader) {
    const head: number[] = [];
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (!l.trim()) {
        if (head.length) break;
        continue;
      }
      if (isChordLine(l) || parseSectionHeader(l)) break;
      head.push(i);
      if (head.length > 3) break;
    }
    if (head.length >= 1 && head.length <= 3) {
      title = title ?? lines[head[0]].trim();
      artist = artist ?? (head[1] !== undefined ? lines[head[1]].trim() : undefined);
      head.forEach((i) => (lines[i] = ''));
    }
  }

  /* ---- separação em blocos ---- */
  interface Draft {
    type: SectionType;
    label: string;
    raw: string[];
    explicit: boolean;
  }
  const hasHeaders = lines.some((l) => parseSectionHeader(l));
  const drafts: Draft[] = [];
  let cur: Draft | null = null;
  for (const l of lines) {
    const h = parseSectionHeader(l);
    if (h) {
      cur = { type: h.type, label: h.label, raw: [], explicit: true };
      drafts.push(cur);
      continue;
    }
    if (!l.trim()) {
      // Sem marcadores: quebra de linha dupla separa blocos (estilo Holyrics)
      if (!hasHeaders && cur && cur.raw.length) cur = null;
      continue;
    }
    if (!cur) {
      cur = { type: 'verse', label: '', raw: [], explicit: false };
      drafts.push(cur);
    }
    cur.raw.push(l);
  }

  /* ---- tipos e rótulos dos blocos sem marcador ---- */
  const sig = (d: Draft) =>
    parseLines(d.raw).map((x) => x.text.trim().toLowerCase()).filter(Boolean).join('|');
  const sigCount = new Map<string, number>();
  drafts.forEach((d) => {
    const s = sig(d);
    if (s) sigCount.set(s, (sigCount.get(s) ?? 0) + 1);
  });
  const counters: Partial<Record<SectionType, number>> = {};
  drafts.forEach((d, i) => {
    if (d.explicit) return;
    const parsed = parseLines(d.raw);
    if (i === 0 && parsed.length && parsed.every((x) => !x.text.trim())) d.type = 'intro';
    else if ((sigCount.get(sig(d)) ?? 0) >= 2) d.type = 'chorus';
    const n = (counters[d.type] = (counters[d.type] ?? 0) + 1);
    d.label = d.type === 'chorus' || d.type === 'intro' ? SECTION_LABELS[d.type] : `${SECTION_LABELS[d.type]} ${n}`;
  });

  const blocks: SongBlock[] = drafts.map((d) => ({
    id: uid(),
    type: d.type,
    label: d.label,
    lines: parseLines(d.raw),
  }));

  /* ---- tom: informado > primeiro acorde ---- */
  let guessed: string | undefined;
  outer: for (const b of blocks)
    for (const l of b.lines)
      for (const c of l.chords) {
        const p = parseChord(c.chord);
        if (p) {
          guessed = p.root + (/^(?:m(?!aj)|min)/.test(p.suffix) ? 'm' : '');
          break outer;
        }
      }

  /*
   * Capotraste lido do PDF: as cifras impressas são o FORMATO tocado.
   * Normalizamos para o som real (formato + capo) e mantemos `capo` no app,
   * assim a tela volta a exibir exatamente o formato do PDF.
   */
  const capoFinal = capo ?? opts.capo ?? 0;
  let originalKey = opts.originalKey ?? guessed ?? key ?? 'C';
  if (capoFinal > 0 && !opts.originalKey) {
    const flats = keyUsesFlats(transposeKey(originalKey, capoFinal));
    blocks.forEach((b) =>
      b.lines.forEach((l) =>
        l.chords.forEach((c) => (c.chord = transposeChord(c.chord, capoFinal, flats))),
      ),
    );
    originalKey = transposeKey(originalKey, capoFinal);
  }

  return {
    id: opts.id ?? uid(),
    title: title || opts.titleHint || 'Sem título',
    artist: artist ?? '',
    originalKey,
    currentKey: originalKey,
    capo: capoFinal,
    bpm: opts.bpm ?? bpm,
    timeSignature: '4/4',
    tuning,
    blocks,
    updatedAt: Date.now(),
  };
}
