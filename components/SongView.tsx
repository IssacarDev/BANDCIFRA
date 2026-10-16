'use client';
import { createContext, useContext, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { LyricLine, Prefs, Song, SongBlock, ViewMode } from '@/types/song';
import { buildContext, chordKind, resolveChord, type ChordContext } from '@/lib/chords';
import { cn } from '@/lib/utils';
import ChordToken, { InteractiveChords } from './ChordToken';

/** Máximo de caracteres por linha que cabem na largura (para quebrar linha sem perder a posição dos acordes). */
const WrapCtx = createContext<number>(Infinity);

/** Edição das quebras de página (só admin): barras entre as linhas para dividir/juntar. */
interface BreakEdit { breaks: string[]; toggle: (key: string) => void; skip: string }
const BreakCtx = createContext<BreakEdit | null>(null);

function BreakBar({ rowKey }: { rowKey: string }) {
  const ed = useContext(BreakCtx);
  if (!ed || rowKey === ed.skip) return null;
  const on = ed.breaks.includes(rowKey);
  return (
    <button
      type="button"
      onClick={() => ed.toggle(rowKey)}
      title={on ? 'Remover a quebra de página' : 'Começar uma nova página aqui'}
      className={`group/bar relative flex w-full items-center justify-center font-sans ${on ? 'h-9' : 'h-4 hover:h-8'}`}
    >
      <span className={`absolute inset-x-0 top-1/2 border-t-2 border-dashed ${on ? 'border-accent' : 'border-transparent group-hover/bar:border-accent/50'}`} />
      <span
        className={`relative rounded-full px-3 py-0.5 text-[11px] font-bold ${on ? 'bg-accent text-accentfg' : 'bg-card text-accent opacity-0 ring-1 ring-accent/40 group-hover/bar:opacity-100'}`}
        style={{ fontSize: 11 }}
      >
        {on ? '✂ nova página aqui · tocar remove' : '+ nova página aqui'}
      </span>
    </button>
  );
}

const FIT_STEPS = [1, 0.94, 0.88, 0.82, 0.76, 0.7, 0.64, 0.58, 0.52, 0.46, 0.4];


interface Unit { top: number; bottom: number; block: number }

/**
 * Divide a cifra em páginas de altura H quebrando entre linhas: usa o menor número de páginas,
 * equilibra o preenchimento (sem sobrar uma linha solta na última), prefere quebrar entre blocos
 * e evita deixar uma única linha de um bloco sozinha em cima/embaixo de uma página.
 */
function paginate(units: Unit[], H: number): number[] {
  const n = units.length;
  if (n < 2) return [];
  const span = (i: number, j: number) => units[j - 1].bottom - units[i].top;
  const greedy: number[] = [];
  for (let i = 0; i < n; ) {
    let j = i + 1;
    while (j < n && span(i, j + 1) <= H) j++;
    if (j < n) greedy.push(j);
    i = j;
  }
  const N = greedy.length + 1;
  if (N === 1) return [];

  const BIG = 1e12;
  const P = (0.1 * H) ** 2;
  const orphan = H * H;
  const cost = (i: number, j: number, last: boolean) => {
    const used = span(i, j);
    if (used > H && j - i > 1) return BIG;
    let c = Math.max(0, H - used) ** 2 * (last ? 0.3 : 1);
    if (j < n && units[j - 1].block === units[j].block) {
      c += P;
      if (j - 1 === 0 || units[j - 2].block !== units[j - 1].block) c += orphan;
      if (j + 1 >= n || units[j + 1].block !== units[j].block) c += orphan;
    }
    return c;
  };
  const f: number[][] = Array.from({ length: N + 1 }, () => Array(n + 1).fill(Infinity));
  const par: number[][] = Array.from({ length: N + 1 }, () => Array(n + 1).fill(-1));
  f[0][0] = 0;
  for (let p = 1; p <= N; p++) {
    for (let j = p; j <= n; j++) {
      if (p === N && j !== n) continue;
      for (let i = p - 1; i < j; i++) {
        if (f[p - 1][i] === Infinity) continue;
        const v = f[p - 1][i] + cost(i, j, p === N);
        if (v < f[p][j]) {
          f[p][j] = v;
          par[p][j] = i;
        }
      }
    }
  }
  if (!isFinite(f[N][n]) || f[N][n] >= BIG) return greedy;
  const out: number[] = [];
  for (let p = N, j = n; p > 1; p--) {
    const i = par[p][j];
    out.unshift(i);
    j = i;
  }
  return out;
}

/** Layout em "páginas" laterais (modo apresentação): colunas de altura fixa, deslocadas para o lado. */
export interface PagedLayout {
  cols: 1 | 2;
  gap: number;
  width: number;
  height: number;
  page: number;
  onMeasure: (pages: number) => void;
}

interface Props {
  song: Song;
  prefs: Prefs;
  columns: 1 | 2 | 'pages';
  mode: ViewMode;
  paged?: PagedLayout;
  interactive?: boolean;
  /** quebras manuais (se houver, substituem a divisão automática) */
  breakKeys?: string[];
  /** informa onde a divisão automática colocou as quebras */
  onAutoBreaks?: (keys: string[]) => void;
  /** modo de edição das quebras (barras clicáveis entre as linhas) */
  breakEdit?: { breaks: string[]; toggle: (key: string) => void };
}

export default function SongView({ song, prefs, columns, mode, paged, interactive = true, breakKeys, onAutoBreaks, breakEdit }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const probe = useRef<HTMLDivElement>(null);
  const [maxCh, setMaxCh] = useState(Infinity);
  const ctx = useMemo(
    () =>
      buildContext(song, { simplified: prefs.simplified, showSounding: prefs.showSounding }),
    [song.originalKey, song.currentKey, song.capo, prefs.simplified, prefs.showSounding], // eslint-disable-line react-hooks/exhaustive-deps
  );

  /* quantos caracteres cabem por linha (fonte monoespaçada) */
  useLayoutEffect(() => {
    const el = ref.current;
    const pr = probe.current;
    if (!el || !pr) return;
    const measure = () => {
      const w = pr.clientWidth;
      const ch = pr.firstElementChild?.getBoundingClientRect().width ?? 0;
      if (w > 0 && ch > 0) {
        const n = Math.max(8, Math.floor(w / ch - 0.5));
        setMaxCh((old) => (old === n ? old : n));
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    document.fonts?.ready.then(measure);
    return () => ro.disconnect();
  }, [columns, paged?.width, paged?.cols, prefs.fontSize, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Duas colunas sem rolagem: a altura é fixa e o texto flui coluna a coluna
   * (blocos nunca são quebrados). Se ainda transbordar para uma 3ª coluna,
   * reduzimos a fonte (--fit) em passos até caber.
   */
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (columns !== 2) {
      el.style.setProperty('--fit', '1');
      return;
    }
    const fit = () => {
      for (const s of FIT_STEPS) {
        el.style.setProperty('--fit', String(s));
        if (el.scrollWidth <= el.clientWidth + 1) break;
      }
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [columns, mode, song.blocks, ctx, prefs.fontSize, prefs.chordSize, maxCh]);

  const pagedKey = paged ? `${paged.cols}|${paged.gap}|${paged.width}|${paged.height}` : '';
  const onMeasure = paged?.onMeasure;

  /* paginação inteligente (só 1 coluna): escolhe onde cada página termina */
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !paged || paged.cols !== 1) return;
    const run = () => {
      const clear = () => el.querySelectorAll<HTMLElement>('[data-row],[data-block]').forEach((n) => (n.style.breakBefore = ''));
      clear();
      const keep = { h: el.style.height, c: el.style.columnCount, t: el.style.transform, tr: el.style.transition };
      el.style.height = 'auto';
      el.style.columnCount = '1';
      el.style.transform = 'none';
      el.style.transition = 'none';
      const top0 = el.getBoundingClientRect().top;
      const units: Unit[] = [];
      const els: { row: HTMLElement; section: HTMLElement; first: boolean }[] = [];
      const keys: string[] = [];
      el.querySelectorAll<HTMLElement>('[data-block]').forEach((sec, bi) => {
        const sr = sec.getBoundingClientRect();
        const rows = Array.from(sec.querySelectorAll<HTMLElement>('[data-row]'));
        rows.forEach((r, ri) => {
          const rr = r.getBoundingClientRect();
          units.push({
            top: (ri === 0 ? sr.top : rr.top) - top0,
            bottom: (ri === rows.length - 1 ? sr.bottom : rr.bottom) - top0,
            block: bi,
          });
          els.push({ row: r, section: sec, first: ri === 0 });
          keys.push(r.dataset.key ?? '');
        });
      });
      el.style.height = keep.h;
      el.style.columnCount = keep.c;
      el.style.transform = keep.t;
      el.style.transition = keep.tr;
      const auto = paginate(units, paged.height - 6);
      const keyAt = (i: number) => {
        for (let k = i; k >= 0; k--) if (keys[k]) return keys[k];
        return '';
      };
      onAutoBreaks?.(Array.from(new Set(auto.map(keyAt).filter(Boolean))));
      const manual = breakKeys && breakKeys.length ? new Set(breakKeys) : null;
      const manualStarts = manual ? keys.map((k, i) => (k && i > 0 && manual.has(k) ? i : -1)).filter((i) => i > 0) : [];
      const starts = manualStarts.length ? manualStarts : auto;
      starts.forEach((i) => {
        const t = els[i];
        if (t) (t.first ? t.section : t.row).style.breakBefore = 'column';
      });
    };
    run();
    let alive = true;
    document.fonts?.ready.then(() => alive && run());
    return () => {
      alive = false;
    };
  }, [pagedKey, song.blocks, ctx, prefs.fontSize, prefs.chordSize, prefs.colorChords, mode, maxCh, (breakKeys ?? []).join('|')]); // eslint-disable-line react-hooks/exhaustive-deps

  /* conta quantas páginas laterais a cifra ocupa */
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !paged || !onMeasure) return;
    const measure = () => {
      const step = paged.width + paged.gap;
      onMeasure(Math.max(1, Math.ceil((el.scrollWidth + paged.gap - 1) / step)));
    };
    measure();
    let alive = true;
    document.fonts?.ready.then(() => alive && measure());
    return () => {
      alive = false;
    };
  }, [pagedKey, song.blocks, ctx, prefs.fontSize, prefs.chordSize, prefs.colorChords, mode, maxCh]); // eslint-disable-line react-hooks/exhaustive-deps

  const style = {
    '--lyric': `${prefs.fontSize}px`,
    '--chordsz': `${prefs.chordSize}px`,
    ...(paged
      ? {
          '--fit': 1,
          columnCount: paged.cols,
          columnGap: paged.gap,
          columnFill: 'auto',
          width: paged.width,
          height: paged.height,
          transform: `translateX(${-paged.page * (paged.width + paged.gap)}px)`,
          transition: 'transform 0.35s cubic-bezier(.2,.8,.2,1)',
        }
      : {}),
  } as CSSProperties;

  return (
    <InteractiveChords.Provider value={interactive}>
    <WrapCtx.Provider value={maxCh}>
    <BreakCtx.Provider value={breakEdit ? { ...breakEdit, skip: song.blocks[0] ? (mode === 'compact' ? `${song.blocks[0].id}:g0` : `${song.blocks[0].id}:0`) : '' } : null}>
    <div ref={ref} className={cn('song-root', columns === 2 && 'song-columns', paged && 'song-paged')} style={style}>
      <div ref={probe} aria-hidden style={{ height: 0, overflow: 'hidden', visibility: 'hidden', fontSize: 'calc(var(--lyric) * var(--fit))' }}>
        <span style={{ display: 'inline-block', width: '1ch' }} />
      </div>
      {song.blocks.length === 0 && (
        <p className="text-muted">Esta cifra ainda não tem blocos. Use “Editar” para adicionar.</p>
      )}
      {song.blocks.map((b) =>
        mode === 'compact' ? (
          <CompactBlock key={b.id} block={b} ctx={ctx} capo={song.capo} colored={prefs.colorChords} />
        ) : (
          <FullBlock key={b.id} block={b} ctx={ctx} capo={song.capo} colored={prefs.colorChords} ratio={prefs.chordSize / prefs.fontSize} />
        ),
      )}
    </div>
    </BreakCtx.Provider>
    </WrapCtx.Provider>
    </InteractiveChords.Provider>
  );
}

/* ------------------------------------------------------------------ */

const labelColor: Record<SongBlock['type'], string> = {
  intro: 'text-muted',
  verse: 'text-muted',
  'pre-chorus': 'text-accent/80',
  chorus: 'text-accent',
  bridge: 'text-chord/90',
  solo: 'text-chord/90',
  outro: 'text-muted',
};

/** Título do bloco: nome em versalete + fio que se estende até a margem. */
function BlockLabel({ block }: { block: SongBlock }) {
  return (
    <div className="mb-2 flex items-center gap-3 font-display" style={{ fontSize: 'calc(var(--lyric) * var(--fit) * 0.58)' }}>
      <span className={cn('font-extrabold uppercase tracking-[0.2em]', labelColor[block.type])}>{block.label}</span>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

/** O refrão ganha um painel suave para se destacar do resto. */
const blockShell = (t: SongBlock['type']) =>
  cn('song-block', t === 'chorus' && '-mx-4 rounded-2xl bg-accent/[0.08] px-4 py-3 ring-1 ring-accent/20');

/** Visão completa: letra com acordes posicionados sobre as sílabas. */
function FullBlock({ block, ctx, capo, ratio, colored }: { block: SongBlock; ctx: ChordContext; capo: number; ratio: number; colored: boolean }) {
  return (
    <section data-block className={blockShell(block.type)}>
      <BlockLabel block={block} />
      {block.lines.map((line, i) => (
        <Line key={i} rowKey={`${block.id}:${i}`} line={line} ctx={ctx} capo={capo} ratio={ratio} colored={colored} />
      ))}
    </section>
  );
}

interface Placed { label: string; shape: string; pos: number }

/**
 * Quebra a linha de letra no espaço mais próximo do limite e leva cada acorde para a
 * quebra em que está a sua sílaba, mantendo a posição relativa.
 */
function layoutLine(line: LyricLine, ctx: ChordContext, ratio: number, colored: boolean, maxCh: number): { text: string; chords: Placed[] }[] {
  const text = line.text;
  const gapCh = colored ? 2 : 1;
  const width = (label: string) => Math.ceil(label.length * ratio) + gapCh;
  const resolved = [...line.chords]
    .sort((a, b) => a.charIndex - b.charIndex)
    .map((c) => ({ ...resolveChord(c.chord, ctx), idx: c.charIndex }));

  const push = (items: { label: string; shape: string; pos: number }[]) => {
    let min = 0;
    return items.map((c) => {
      const pos = Math.max(c.pos, min);
      min = pos + width(c.label);
      return { ...c, pos };
    });
  };

  // segmentos de texto
  const segs: { start: number; end: number }[] = [];
  if (text.length <= maxCh) segs.push({ start: 0, end: text.length });
  else {
    let start = 0;
    while (start < text.length) {
      let end = Math.min(text.length, start + maxCh);
      if (end < text.length) {
        const k = text.slice(start, end).lastIndexOf(' ');
        if (k > 0) end = start + k + 1;
      }
      segs.push({ start, end });
      start = end;
    }
  }

  // linha só de acordes que não cabe: empacota em várias linhas
  if (!text.trim()) {
    const all = push(resolved.map((c) => ({ label: c.label, shape: c.shape, pos: c.idx })));
    const rows: { text: string; chords: Placed[] }[] = [];
    let cur: Placed[] = [];
    let offset = 0;
    for (const c of all) {
      if (cur.length && c.pos - offset + width(c.label) > maxCh) {
        rows.push({ text: '', chords: cur });
        cur = [];
        offset = c.pos;
      }
      cur.push({ ...c, pos: c.pos - offset });
    }
    rows.push({ text: '', chords: cur });
    return rows;
  }

  return segs.map((sg, si) => {
    const last = si === segs.length - 1;
    const mine = resolved
      .filter((c) => (c.idx >= sg.start && c.idx < sg.end) || (last && c.idx >= sg.end))
      .map((c) => ({ label: c.label, shape: c.shape, pos: c.idx - sg.start }));
    const placed = push(mine).map((c) => ({ ...c, pos: Math.max(0, Math.min(c.pos, maxCh - width(c.label) + gapCh)) }));
    return { text: text.slice(sg.start, sg.end), chords: placed };
  });
}

function Line({ rowKey, line, ctx, capo, ratio, colored }: { rowKey: string; line: LyricLine; ctx: ChordContext; capo: number; ratio: number; colored: boolean }) {
  const maxCh = useContext(WrapCtx);
  const rows = layoutLine(line, ctx, ratio, colored, maxCh);
  return (
    <>
      <BreakBar rowKey={rowKey} />
      {rows.map((row, ri) => (
        <div
          key={ri}
          data-row
          data-key={ri === 0 ? rowKey : undefined}
          className="relative"
          style={{
            fontSize: 'calc(var(--lyric) * var(--fit))',
            paddingTop: row.chords.length ? `calc(var(--chordsz) * var(--fit) * ${colored ? 1.85 : 1.45})` : 0,
          }}
        >
          {row.chords.map((c, i) => (
            <span key={i} className="absolute top-0" style={{ left: `${c.pos}ch` }}>
              <ChordToken
                label={c.label}
                shape={c.shape}
                capo={capo}
                kind={chordKind(c.label)}
                colored={colored}
                style={{ fontSize: 'calc(var(--chordsz) * var(--fit))', fontWeight: 700 }}
              />
            </span>
          ))}
          <div className="whitespace-pre leading-[1.35]">{row.text || ' '}</div>
        </div>
      ))}
    </>
  );
}

/** Modo Palco / Bateria: só a harmonia guia, por bloco. */
function CompactBlock({ block, ctx, capo, colored }: { block: SongBlock; ctx: ChordContext; capo: number; colored: boolean }) {
  const rows = block.lines
    .filter((l) => l.chords.length)
    .map((l) => l.chords.map((c) => resolveChord(c.chord, ctx)));

  // agrupa linhas consecutivas idênticas: "C | G  ×2"
  const grouped: { chords: typeof rows[number]; times: number }[] = [];
  for (const r of rows) {
    const last = grouped[grouped.length - 1];
    if (last && last.chords.map((c) => c.label).join() === r.map((c) => c.label).join()) last.times++;
    else grouped.push({ chords: r, times: 1 });
  }

  return (
    <section data-block className={blockShell(block.type)}>
      <BlockLabel block={block} />
      {grouped.length === 0 && <div className="text-muted">—</div>}
      {grouped.map((g, i) => (
        <div key={i}>
        <BreakBar rowKey={`${block.id}:g${i}`} />
        <div
          data-row
          data-key={`${block.id}:g${i}`}
          className="flex flex-wrap items-baseline gap-x-2 leading-tight"
          style={{ fontSize: 'calc(var(--chordsz) * var(--fit) * 1.6)' }}
        >
          {g.chords.map((c, j) => (
            <span key={j} className="inline-flex items-baseline gap-2">
              <ChordToken label={c.label} shape={c.shape} capo={capo} kind={chordKind(c.label)} colored={colored} />
              {j < g.chords.length - 1 && <span className="text-muted">|</span>}
            </span>
          ))}
          {g.times > 1 && (
            <span className="font-sans text-muted" style={{ fontSize: '0.6em' }}>
              ×{g.times}
            </span>
          )}
        </div>
        </div>
      ))}
    </section>
  );
}
