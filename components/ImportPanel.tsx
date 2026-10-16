'use client';
import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, FileText, Loader2, Upload } from 'lucide-react';
import { useStore } from '@/lib/store';
import { useHydrated } from '@/hooks/useHydrated';
import { parseCifraText } from '@/lib/parser';
import { parsePdfToText } from '@/lib/pdfParser';
import { Btn, Seg } from './ui';
import { cn } from '@/lib/utils';

export default function ImportPanel() {
  const router = useRouter();
  const hydrated = useHydrated();
  const addSong = useStore((s) => s.addSong);

  const [tab, setTab] = useState<'pdf' | 'text'>('pdf');
  const [raw, setRaw] = useState('');
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [over, setOver] = useState(false);
  const [ov, setOv] = useState({ title: '', artist: '', key: '' });
  const fileRef = useRef<HTMLInputElement>(null);

  const parsed = useMemo(
    () =>
      raw.trim()
        ? parseCifraText(raw, {
            detectHeader: tab === 'pdf',
            titleHint: fileName.replace(/\.pdf$/i, '') || undefined,
          })
        : null,
    [raw, tab, fileName],
  );

  const loadPdf = async (file?: File) => {
    if (!file) return;
    if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
      setError('Selecione um arquivo PDF.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      setFileName(file.name);
      setRaw(await parsePdfToText(file));
    } catch (e) {
      setError(`Não foi possível ler o PDF: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const save = (edit: boolean) => {
    if (!parsed) return;
    const song = {
      ...parsed,
      title: ov.title.trim() || parsed.title,
      artist: ov.artist.trim() || parsed.artist,
      ...(ov.key.trim() ? { originalKey: ov.key.trim(), currentKey: ov.key.trim() } : {}),
    };
    addSong(song);
    router.push(edit ? `/song/${song.id}/edit` : `/song/${song.id}`);
  };

  const input = 'w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm';
  if (!hydrated) return <div className="p-6 text-muted" suppressHydrationWarning>Carregando…</div>;

  return (
    <div className="mx-auto max-w-4xl px-4 py-4 pb-20">
      <div className="mb-4 flex items-center gap-2">
        <Link href="/" className="rounded-lg border border-line p-2 hover:border-accent" aria-label="Voltar">
          <ArrowLeft size={16} />
        </Link>
        <h1 className="mr-auto font-display text-2xl font-bold">Importar cifra</h1>
        <Seg
          value={tab}
          onChange={(v) => { setTab(v); setRaw(''); setFileName(''); setError(''); }}
          options={[
            { value: 'pdf', label: 'PDF (Cifra Club)' },
            { value: 'text', label: 'Colar texto' },
          ]}
        />
      </div>

      {tab === 'pdf' ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); loadPdf(e.dataTransfer.files[0]); }}
          onClick={() => fileRef.current?.click()}
          className={cn(
            'flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed p-8 text-center transition',
            over ? 'border-accent bg-accent/10' : 'border-line bg-card hover:border-accent',
          )}
        >
          {busy ? <Loader2 className="animate-spin" /> : <Upload />}
          <p className="font-medium">{fileName || 'Arraste o PDF aqui ou clique para escolher'}</p>
          <p className="text-xs text-muted">
            O arquivo é lido localmente no navegador — nada é enviado a servidores.
          </p>
          <input ref={fileRef} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => loadPdf(e.target.files?.[0])} />
        </div>
      ) : (
        <div>
          <p className="mb-2 text-xs text-muted">
            Cole a cifra (acordes sobre a letra) ou só a letra. Linhas em branco ou marcadores como
            <code className="mx-1 rounded bg-card px-1">[Verso]</code>
            <code className="rounded bg-card px-1">[Refrão]</code> criam os blocos.
          </p>
          <textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            rows={12}
            spellCheck={false}
            wrap="off"
            className="w-full whitespace-pre rounded-xl border border-line bg-card p-3 font-mono text-sm"
            placeholder={'[Intro]\nG  D  Em  C\n\n[Verso 1]\nG        D\nLetra da música...'}
          />
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

      {parsed && (
        <section className="mt-5 space-y-4">
          <div className="grid grid-cols-2 gap-3 rounded-3xl border border-line bg-card p-3 sm:grid-cols-4">
            <label className="col-span-2 text-xs text-muted">Título
              <input className={input} placeholder={parsed.title} value={ov.title} onChange={(e) => setOv({ ...ov, title: e.target.value })} />
            </label>
            <label className="col-span-2 text-xs text-muted">Artista
              <input className={input} placeholder={parsed.artist || '—'} value={ov.artist} onChange={(e) => setOv({ ...ov, artist: e.target.value })} />
            </label>
            <label className="text-xs text-muted">Tom
              <input className={input} placeholder={parsed.originalKey} value={ov.key} onChange={(e) => setOv({ ...ov, key: e.target.value })} />
            </label>
            <div className="text-xs text-muted">Capotraste<div className="py-1.5 text-sm text-ink">{parsed.capo ? `${parsed.capo}ª casa` : 'sem'}</div></div>
            <div className="col-span-2 text-xs text-muted">Afinação<div className="py-1.5 text-sm text-ink">{parsed.tuning ?? 'padrão'}</div></div>
          </div>

          <div className="rounded-3xl border border-line bg-card p-3">
            <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
              <FileText size={15} /> {parsed.blocks.length} blocos detectados
            </h2>
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {parsed.blocks.map((b) => (
                <li key={b.id} className="flex items-center justify-between rounded-lg bg-surface px-2.5 py-1.5 text-sm">
                  <span className="font-medium">{b.label}</span>
                  <span className="text-xs text-muted">
                    {b.lines.length} linhas · {b.lines.reduce((n, l) => n + l.chords.length, 0)} acordes
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {tab === 'pdf' && (
            <details className="rounded-3xl border border-line bg-card p-3">
              <summary className="cursor-pointer text-sm font-semibold">Texto extraído (corrija se necessário)</summary>
              <textarea
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                rows={14}
                spellCheck={false}
                wrap="off"
                className="mt-2 w-full whitespace-pre rounded-lg border border-line bg-surface p-2 font-mono text-xs"
              />
            </details>
          )}

          <div className="flex justify-end gap-2">
            <Btn onClick={() => save(true)}>Salvar e editar blocos</Btn>
            <Btn variant="solid" onClick={() => save(false)}>Salvar na biblioteca</Btn>
          </div>
        </section>
      )}
    </div>
  );
}
