'use client';
import { useMemo, useRef, useState } from 'react';
import { LogOut, Lock } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { LoginDialog } from './LoginDialog';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowDown, ArrowUp, Copy, Download, FileUp, ListMusic, Pencil, Play, Plus, Search, Trash2, Upload, X,
} from 'lucide-react';
import { useStore } from '@/lib/store';
import { useHydrated } from '@/hooks/useHydrated';
import { exportBackup, parseBackup } from '@/lib/backup';
import { cn, uid } from '@/lib/utils';
import type { Setlist, Song } from '@/types/song';
import { Btn, Seg } from './ui';

export default function Library() {
  const router = useRouter();
  const hydrated = useHydrated();
  const { songs, setlists, prefs } = useStore();
  const { addSong, removeSong, saveAsVersion, setPrefs, addSetlist, removeSetlist, setSetlistSongs, renameSetlist, importBackup } =
    useStore.getState();

  const isAdmin = useAuth((s) => s.isAdmin);
  const logout = useAuth((s) => s.logout);
  const [loginOpen, setLoginOpen] = useState(false);
  const [tab, setTab] = useState<'songs' | 'setlists'>('songs');
  const [q, setQ] = useState('');
  const [newName, setNewName] = useState('');
  const [msg, setMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? songs.filter((s) => `${s.title} ${s.artist}`.toLowerCase().includes(t)) : songs;
  }, [songs, q]);

  if (!hydrated) return <div className="p-6 text-muted" suppressHydrationWarning>Carregando…</div>;

  const createBlank = () => {
    const song: Song = {
      id: uid(), title: 'Nova cifra', artist: '', originalKey: 'C', currentKey: 'C', capo: 0,
      timeSignature: '4/4', bpm: 80, blocks: [], updatedAt: Date.now(),
    };
    addSong(song);
    router.push(`/song/${song.id}/edit`);
  };

  const onRestore = async (file?: File) => {
    if (!file) return;
    try {
      const b = parseBackup(await file.text());
      const replace = window.confirm(
        `Backup com ${b.songs.length} cifras e ${b.setlists.length} repertórios.\n\nOK = substituir tudo · Cancelar = mesclar com o que já existe`,
      );
      importBackup(b, replace ? 'replace' : 'merge');
      setMsg('Backup restaurado.');
    } catch (e) {
      setMsg((e as Error).message);
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl px-4 pb-28 pt-8 sm:px-5 sm:pt-10">
      {/* cabeçalho */}
      <header className="rise mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 font-display text-xs font-bold uppercase tracking-[0.24em] text-accent">Songbook</p>
          <h1 className="font-display text-4xl font-extrabold leading-none tracking-tight sm:text-5xl">Minhas cifras</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Seg
            value={prefs.theme}
            onChange={(v) => setPrefs({ theme: v })}
            options={[
              { value: 'light', label: 'Claro' },
              { value: 'dark', label: 'Escuro' },
              { value: 'oled', label: 'OLED' },
            ]}
          />
          {isAdmin ? (
            <Btn onClick={logout} title="Sair do modo admin"><LogOut size={15} /> Admin · Sair</Btn>
          ) : (
            <Btn onClick={() => setLoginOpen(true)} title="Entrar como administrador"><Lock size={15} /> Entrar</Btn>
          )}
        </div>
      </header>
      <LoginDialog open={loginOpen} onClose={() => setLoginOpen(false)} />

      {/* ações (só admin) */}
      {isAdmin && (
      <div className="rise mb-8 flex flex-wrap gap-3">
        <Link
          href="/import"
          className="inline-flex min-h-12 items-center gap-2 rounded-full bg-accent px-6 text-base font-bold text-accentfg shadow-soft transition hover:brightness-110 active:scale-[0.98]"
        >
          <FileUp size={18} /> Importar cifra
        </Link>
        <button
          onClick={createBlank}
          className="inline-flex min-h-12 items-center gap-2 rounded-full border border-line bg-card px-6 text-base font-bold transition hover:border-accent/50 hover:bg-accent/10 active:scale-[0.98]"
        >
          <Plus size={18} /> Nova em branco
        </button>
        <p className="flex w-full items-center text-sm text-muted sm:ml-1 sm:w-auto">PDF do Cifra Club ou texto colado</p>
      </div>
      )}

      {/* abas + busca */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Seg
          value={tab}
          onChange={setTab}
          options={[
            { value: 'songs', label: `Músicas · ${songs.length}` },
            { value: 'setlists', label: `Repertórios · ${setlists.length}` },
          ]}
        />
        {tab === 'songs' && (
          <div className="relative min-w-[12rem] flex-1">
            <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar título ou artista"
              className="min-h-11 w-full rounded-full border border-line bg-card pl-11 pr-4 text-sm outline-none transition placeholder:text-muted focus:border-accent"
            />
          </div>
        )}
      </div>

      {tab === 'songs' ? (
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-3">
          {filtered.map((s, i) => (
            <li
              key={s.id}
              style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
              className="rise group rounded-3xl border border-line bg-card transition hover:border-accent/40 hover:shadow-lift"
            >
              <Link href={`/song/${s.id}`} className="flex items-center gap-4 p-4 pb-3">
                <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl bg-chord/15 text-chord">
                  <span className="font-display text-2xl font-extrabold leading-none">{s.currentKey}</span>
                  <span className="mt-1 text-[10px] font-bold uppercase tracking-widest opacity-70">tom</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-display text-xl font-bold leading-tight">{s.title}</div>
                  <div className="truncate text-sm text-muted">{s.artist || 'Sem artista'}</div>
                  <div className="mt-2 flex flex-wrap gap-1.5 text-xs font-semibold">
                    {s.capo > 0 && <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-accent">Capo {s.capo}</span>}
                    {s.bpm && <span className="rounded-full bg-line/70 px-2.5 py-0.5 text-muted">{s.bpm} BPM</span>}
                    <span className="rounded-full bg-line/70 px-2.5 py-0.5 text-muted">{s.blocks.length} blocos</span>
                    {s.variantOf && <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-accent">Minha versão</span>}
                  </div>
                </div>
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent transition group-hover:bg-accent group-hover:text-accentfg">
                  <Play size={18} fill="currentColor" className="ml-0.5" />
                </span>
              </Link>
              {isAdmin && (
              <div className="flex gap-1 px-3 pb-3 text-sm font-semibold text-muted">
                <Link href={`/song/${s.id}/edit`} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 hover:bg-accent/10 hover:text-ink"><Pencil size={14} /> Editar</Link>
                <button onClick={() => saveAsVersion(s.id, { title: `${s.title} — Minha versão` })} title="Cria uma cópia para você alterar sem mexer na original" className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 hover:bg-accent/10 hover:text-ink"><Copy size={14} /> Duplicar</button>
                <button onClick={() => window.confirm(`Excluir “${s.title}”?`) && removeSong(s.id)} className="ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 hover:bg-red-500/10 hover:text-red-500"><Trash2 size={14} /> Excluir</button>
              </div>
              )}
            </li>
          ))}
          {!filtered.length && (
            <li className="rounded-3xl border border-dashed border-line py-14 text-center text-muted">
              {q ? 'Nenhuma cifra encontrada para essa busca.' : isAdmin ? 'Nenhuma cifra ainda. Importe um PDF ou crie uma nova.' : 'Nenhuma cifra disponível ainda.'}
            </li>
          )}
        </ul>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Um repertório é uma lista de músicas em ordem, como “Culto de Domingo”. Ao tocar, use as setas do teclado ou deslize para trocar de música.
          </p>
          {isAdmin && (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (newName.trim()) { addSetlist(newName.trim()); setNewName(''); }
            }}
          >
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nome do novo repertório"
              className="min-h-11 min-w-0 flex-1 rounded-full border border-line bg-card px-5 text-sm outline-none placeholder:text-muted focus:border-accent"
            />
            <Btn variant="solid" type="submit"><Plus size={16} /> Criar</Btn>
          </form>
          )}
          {setlists.map((l) => (
            <SetlistCard
              key={l.id}
              list={l}
              admin={isAdmin}
              songs={songs}
              onRename={(n) => renameSetlist(l.id, n)}
              onSongs={(ids) => setSetlistSongs(l.id, ids)}
              onRemove={() => window.confirm(`Excluir o repertório “${l.name}”?`) && removeSetlist(l.id)}
            />
          ))}
          {!setlists.length && <p className="rounded-3xl border border-dashed border-line py-14 text-center text-muted">{isAdmin ? 'Nenhum repertório criado.' : 'Nenhum repertório disponível.'}</p>}
        </div>
      )}

      {isAdmin && (
      <footer className="mt-14 rounded-3xl border border-line bg-card p-5">
        <h2 className="font-display text-lg font-bold">Backup</h2>
        <p className="mb-4 mt-1 text-sm text-muted">
          Suas cifras ficam salvas só neste navegador. Exporte um arquivo para guardar ou levar para outro aparelho.
        </p>
        <div className="flex flex-wrap gap-2">
          <Btn onClick={() => exportBackup(songs, setlists)}><Download size={16} /> Exportar tudo</Btn>
          <Btn onClick={() => fileRef.current?.click()}><Upload size={16} /> Restaurar backup</Btn>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => onRestore(e.target.files?.[0])} />
        </div>
        <p className="mt-3 text-xs text-muted">Para gerar PDF de uma cifra: abra a música, depois Ajustes e Imprimir ou salvar em PDF.</p>
        {msg && <p className="mt-2 text-sm">{msg}</p>}
      </footer>
      )}
    </div>
  );
}

function SetlistCard({
  list, songs, admin, onRename, onSongs, onRemove,
}: {
  admin: boolean;
  list: Setlist;
  songs: Song[];
  onRename: (n: string) => void;
  onSongs: (ids: string[]) => void;
  onRemove: () => void;
}) {
  const byId = (id: string) => songs.find((s) => s.id === id);
  const available = songs.filter((s) => !list.songIds.includes(s.id));
  const move = (i: number, d: number) => {
    const ids = [...list.songIds];
    const j = i + d;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    onSongs(ids);
  };

  return (
    <section className="rounded-3xl border border-line bg-card p-5">
      <div className="mb-4 flex items-center gap-3">
        <ListMusic size={20} className="shrink-0 text-accent" />
        <input
          readOnly={!admin}
          defaultValue={list.name}
          onBlur={(e) => e.target.value.trim() && onRename(e.target.value.trim())}
          className="min-w-0 flex-1 rounded-lg bg-transparent px-1 py-1 font-display text-xl font-bold outline-none focus:bg-accent/10"
          aria-label="Nome do repertório"
        />
        {admin && <Btn variant="danger" onClick={onRemove} title="Excluir repertório" className="!px-3"><Trash2 size={15} /></Btn>}
      </div>

      {list.songIds.length > 0 && (
        <Link
          href={`/song/${list.songIds[0]}?setlist=${list.id}`}
          className="mb-4 flex min-h-12 items-center justify-center gap-2 rounded-full bg-accent font-bold text-accentfg shadow-soft transition hover:brightness-110"
        >
          <Play size={16} fill="currentColor" /> Tocar repertório
        </Link>
      )}

      <ol className="space-y-1.5">
        {list.songIds.map((id, i) => {
          const s = byId(id);
          if (!s) return null;
          return (
            <li key={id} className="flex items-center gap-3 rounded-2xl bg-surface px-4 py-2.5">
              <span className="w-5 font-display text-sm font-bold tabular-nums text-muted">{i + 1}</span>
              <Link href={`/song/${id}?setlist=${list.id}`} className="min-w-0 flex-1 truncate font-medium hover:underline">
                {s.title}
              </Link>
              <span className="rounded-full bg-chord/15 px-2.5 py-0.5 text-xs font-bold text-chord">{s.currentKey}</span>
              {admin && (
                <>
              <button onClick={() => move(i, -1)} disabled={i === 0} className="rounded-full p-1.5 text-muted hover:bg-accent/10 hover:text-ink disabled:opacity-30" aria-label="Subir"><ArrowUp size={16} /></button>
              <button onClick={() => move(i, 1)} disabled={i === list.songIds.length - 1} className="rounded-full p-1.5 text-muted hover:bg-accent/10 hover:text-ink disabled:opacity-30" aria-label="Descer"><ArrowDown size={16} /></button>
              <button onClick={() => onSongs(list.songIds.filter((x) => x !== id))} className="rounded-full p-1.5 text-muted hover:bg-red-500/10 hover:text-red-500" aria-label="Remover do repertório"><X size={16} /></button>
                </>
              )}
            </li>
          );
        })}
      </ol>

      {admin && available.length > 0 && (
        <select
          value=""
          onChange={(e) => e.target.value && onSongs([...list.songIds, e.target.value])}
          className={cn('mt-3 min-h-11 w-full rounded-full border border-dashed border-line bg-surface px-4 text-sm text-muted outline-none focus:border-accent')}
        >
          <option value="">+ Adicionar música a este repertório…</option>
          {available.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
        </select>
      )}
    </section>
  );
}
