'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowDown, ArrowLeft, ArrowUp, Copy, GripVertical, Merge, Plus, Save, Trash2,
} from 'lucide-react';
import { useStore } from '@/lib/store';
import { useHydrated } from '@/hooks/useHydrated';
import {
  duplicateDraft, fromDrafts, mergeDraft, moveDraft, newDraft, SECTION_TYPES, toDrafts, type DraftBlock,
} from '@/lib/blocks';
import { parseCifraText, SECTION_LABELS } from '@/lib/parser';
import type { SectionType } from '@/types/song';
import { Btn } from './ui';
import { cn } from '@/lib/utils';

interface Meta {
  title: string;
  artist: string;
  originalKey: string;
  capo: number;
  bpm: string;
  timeSignature: string;
  tuning: string;
}

const TYPE_NAMES: Record<SectionType, string> = {
  intro: 'Intro', verse: 'Verso', 'pre-chorus': 'Pré-Refrão', chorus: 'Refrão/Coro',
  bridge: 'Ponte', solo: 'Solo', outro: 'Final',
};

export default function Editor({ songId }: { songId: string }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const song = useStore((s) => s.songs.find((x) => x.id === songId));
  const updateSong = useStore((s) => s.updateSong);
  const saveAsVersion = useStore((s) => s.saveAsVersion);

  const [meta, setMeta] = useState<Meta | null>(null);
  const [blocks, setBlocks] = useState<DraftBlock[]>([]);
  const [paste, setPaste] = useState('');
  const [showPaste, setShowPaste] = useState(false);
  const dragFrom = useRef<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  useEffect(() => {
    if (song && !meta) {
      setMeta({
        title: song.title, artist: song.artist, originalKey: song.originalKey, capo: song.capo,
        bpm: song.bpm ? String(song.bpm) : '', timeSignature: song.timeSignature ?? '4/4', tuning: song.tuning ?? '',
      });
      setBlocks(toDrafts(song));
    }
  }, [song, meta]);

  if (!hydrated) return <div className="p-6 text-muted" suppressHydrationWarning>Carregando…</div>;
  if (!song || !meta) return <div className="p-6">Cifra não encontrada. <Link href="/" className="text-accent underline">Voltar</Link></div>;

  const patch = () => ({
    title: meta.title.trim() || 'Sem título',
    artist: meta.artist.trim(),
    originalKey: meta.originalKey.trim() || 'C',
    currentKey: meta.originalKey.trim() === song.originalKey ? song.currentKey : meta.originalKey.trim() || 'C',
    capo: meta.capo,
    bpm: meta.bpm ? Number(meta.bpm) : undefined,
    timeSignature: meta.timeSignature || '4/4',
    tuning: meta.tuning || undefined,
    blocks: fromDrafts(blocks),
  });

  const save = () => {
    updateSong(song.id, patch());
    router.push(`/song/${song.id}`);
  };
  const saveVersion = () => {
    const p = patch();
    const id = saveAsVersion(song.id, { ...p, title: `${p.title} — Minha versão` });
    if (id) router.push(`/song/${id}`);
  };

  const setBlock = (i: number, b: Partial<DraftBlock>) =>
    setBlocks((l) => l.map((x, j) => (j === i ? { ...x, ...b } : x)));

  const addFromPaste = () => {
    const parsed = parseCifraText(paste);
    setBlocks((l) => [...l, ...toDrafts(parsed)]);
    setPaste('');
    setShowPaste(false);
  };

  const input = 'mt-1 min-h-10 w-full rounded-2xl border border-line bg-surface px-3 py-2 text-sm text-ink';

  return (
    <div className="mx-auto max-w-4xl px-4 py-4 pb-24">
      <div className="sticky top-0 z-20 -mx-4 mb-4 flex flex-wrap items-center gap-2 border-b border-line bg-surface/95 px-4 py-3 backdrop-blur">
        <Link href={`/song/${song.id}`} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-line px-3 text-sm font-medium hover:border-accent">
          <ArrowLeft size={16} /> Voltar sem salvar
        </Link>
        <h1 className="mr-auto px-1 font-display text-xl font-bold">Editar cifra</h1>
        <Btn onClick={saveVersion} title="Cria uma cópia com suas mudanças e mantém a original intacta">
          <Copy size={15} /> Salvar como “Minha versão”
        </Btn>
        <Btn variant="solid" onClick={save}>
          <Save size={15} /> Salvar alterações
        </Btn>
      </div>

      {/* metadados */}
      <section className="mb-5 grid grid-cols-2 gap-3 rounded-3xl border border-line bg-card p-3 sm:grid-cols-4">
        <label className="col-span-2 text-xs text-muted">Título
          <input className={input} value={meta.title} onChange={(e) => setMeta({ ...meta, title: e.target.value })} />
        </label>
        <label className="col-span-2 text-xs text-muted">Artista
          <input className={input} value={meta.artist} onChange={(e) => setMeta({ ...meta, artist: e.target.value })} />
        </label>
        <label className="text-xs text-muted">Tom original
          <input className={input} value={meta.originalKey} onChange={(e) => setMeta({ ...meta, originalKey: e.target.value })} placeholder="G, F#m…" />
        </label>
        <label className="text-xs text-muted">Capo
          <select className={input} value={meta.capo} onChange={(e) => setMeta({ ...meta, capo: Number(e.target.value) })}>
            <option value={0}>sem</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}ª casa</option>)}
          </select>
        </label>
        <label className="text-xs text-muted">BPM
          <input className={input} type="number" value={meta.bpm} onChange={(e) => setMeta({ ...meta, bpm: e.target.value })} />
        </label>
        <label className="text-xs text-muted">Compasso
          <input className={input} value={meta.timeSignature} onChange={(e) => setMeta({ ...meta, timeSignature: e.target.value })} placeholder="4/4" />
        </label>
        <label className="col-span-2 text-xs text-muted sm:col-span-4">Afinação
          <input className={input} value={meta.tuning} onChange={(e) => setMeta({ ...meta, tuning: e.target.value })} placeholder="E A D G B E" />
        </label>
      </section>

      <p className="mb-3 text-xs text-muted">
        <b className="text-ink">Como editar:</b> cada bloco é uma parte da música (verso, refrão…). Dentro dele, escreva
        a linha de acordes <b className="text-ink">logo acima</b> da linha da letra, alinhando o acorde com a sílaba.
        Para mudar a ordem, arraste pela alça ⋮⋮ ou use os botões de cada bloco.
      </p>

      <div className="space-y-3">
        {blocks.map((b, i) => (
          <div
            key={b.id}
            onDragOver={(e) => { e.preventDefault(); setOverIdx(i); }}
            onDragLeave={() => setOverIdx((o) => (o === i ? null : o))}
            onDrop={(e) => {
              e.preventDefault();
              if (dragFrom.current !== null) setBlocks((l) => moveDraft(l, dragFrom.current!, i));
              dragFrom.current = null;
              setOverIdx(null);
            }}
            className={cn('rounded-2xl border bg-card p-3 transition', overIdx === i ? 'border-accent ring-2 ring-accent/40' : 'border-line')}
          >
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span
                draggable
                onDragStart={(e) => {
                  dragFrom.current = i;
                  const card = (e.currentTarget as HTMLElement).closest('div[class*="rounded-2xl"]');
                  if (card) e.dataTransfer.setDragImage(card, 12, 12);
                }}
                onDragEnd={() => { dragFrom.current = null; setOverIdx(null); }}
                className="cursor-grab touch-none text-muted active:cursor-grabbing"
                title="Arrastar para reordenar"
              >
                <GripVertical size={18} />
              </span>
              <select
                value={b.type}
                onChange={(e) => {
                  const type = e.target.value as SectionType;
                  const wasDefault = b.label === SECTION_LABELS[b.type];
                  setBlock(i, { type, ...(wasDefault ? { label: SECTION_LABELS[type] } : {}) });
                }}
                className="min-h-10 rounded-2xl border border-line bg-surface px-2 py-2 text-sm"
              >
                {SECTION_TYPES.map((t) => <option key={t} value={t}>{TYPE_NAMES[t]}</option>)}
              </select>
              <input
                value={b.label}
                onChange={(e) => setBlock(i, { label: e.target.value })}
                className="min-h-10 min-w-0 flex-1 rounded-2xl border border-line bg-surface px-3 py-2 text-sm font-medium"
                aria-label="Nome do bloco"
              />
            </div>
            <div className="mb-2 flex flex-wrap gap-1.5">
              <Btn className="!min-h-9 !px-2.5" disabled={i === 0} onClick={() => setBlocks((l) => moveDraft(l, i, i - 1))}><ArrowUp size={14} /> Subir</Btn>
              <Btn className="!min-h-9 !px-2.5" disabled={i === blocks.length - 1} onClick={() => setBlocks((l) => moveDraft(l, i, i + 1))}><ArrowDown size={14} /> Descer</Btn>
              <Btn className="!min-h-9 !px-2.5" onClick={() => setBlocks((l) => duplicateDraft(l, i))} title="Repete este bloco logo abaixo (ex.: refrão depois da ponte)"><Copy size={14} /> Duplicar</Btn>
              <Btn className="!min-h-9 !px-2.5" disabled={i === 0} onClick={() => setBlocks((l) => mergeDraft(l, i, -1))} title="Une este bloco ao de cima"><Merge size={14} className="rotate-180" /> Juntar com anterior</Btn>
              <Btn className="!min-h-9 !px-2.5" disabled={i === blocks.length - 1} onClick={() => setBlocks((l) => mergeDraft(l, i, 1))} title="Une este bloco ao de baixo"><Merge size={14} /> Juntar com próximo</Btn>
              <Btn variant="danger" className="!min-h-9 !px-2.5" onClick={() => setBlocks((l) => l.filter((_, j) => j !== i))}><Trash2 size={14} /> Excluir</Btn>
            </div>
            <textarea
              value={b.text}
              onChange={(e) => setBlock(i, { text: e.target.value })}
              rows={Math.max(3, b.text.split('\n').length + 1)}
              spellCheck={false}
              wrap="off"
              className="w-full resize-y overflow-x-auto whitespace-pre rounded-lg border border-line bg-surface p-2 font-mono text-sm leading-snug"
              placeholder={'G        D\nLetra aqui'}
            />
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Btn variant="solid" onClick={() => setBlocks((l) => [...l, newDraft('verse')])}><Plus size={15} /> Adicionar bloco</Btn>
        <Btn onClick={() => setShowPaste((v) => !v)}>Colar letra e dividir em blocos</Btn>
      </div>

      {showPaste && (
        <div className="mt-3 rounded-3xl border border-line bg-card p-3">
          <p className="mb-2 text-xs text-muted">
            Cole um texto: linhas em branco ou marcadores como [Verso], [Refrão] criam novos blocos.
          </p>
          <textarea
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            rows={8}
            className="w-full rounded-lg border border-line bg-surface p-2 font-mono text-sm"
          />
          <div className="mt-2 flex justify-end">
            <Btn variant="solid" disabled={!paste.trim()} onClick={addFromPaste}>Criar blocos</Btn>
          </div>
        </div>
      )}
    </div>
  );
}
