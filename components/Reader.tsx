'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Columns2, Maximize2, Minimize2, Pencil, Presentation, RotateCcw, SlidersHorizontal,
} from 'lucide-react';
import { useStore } from '@/lib/store';
import { useHydrated } from '@/hooks/useHydrated';
import { useAutoScroll } from '@/hooks/useAutoScroll';
import { useMetronome } from '@/hooks/useMetronome';
import { getKeys, transposeKey } from '@/lib/chords';
import SongView from './SongView';
import Dock from './Dock';
import SettingsDrawer from './SettingsDrawer';
import Presenter from './Presenter';
import { useAuth } from '@/lib/auth';
import { PulseBar } from './MetronomePanel';
import { Seg, Toggle } from './ui';
import { cn } from '@/lib/utils';

const iconBtn =
  'inline-flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full border border-line bg-card text-ink transition hover:border-accent/50 hover:bg-accent/10 active:scale-95 disabled:opacity-30';

export default function Reader({ songId, setlistId, present: presentInit = false }: { songId: string; setlistId?: string; present?: boolean }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const song = useStore((s) => s.songs.find((x) => x.id === songId));
  const setlist = useStore((s) => (setlistId ? s.setlists.find((l) => l.id === setlistId) : undefined));
  const prefs = useStore((s) => s.prefs);
  const setPrefs = useStore((s) => s.setPrefs);
  const updateSong = useStore((s) => s.updateSong);

  const scrollRef = useRef<HTMLElement>(null);
  const [drawer, setDrawer] = useState(false);
  const [focus, setFocus] = useState(false); // tela limpa: esconde a barra superior
  const [metroOn, setMetroOn] = useState(false);
  const [present, setPresent] = useState(presentInit);
  const isAdmin = useAuth((s) => s.isAdmin);
  const [stripOpen, setStripOpen] = useState(true); // controles do topo (Tom, Capo...) abertos/minimizados
  useEffect(() => {
    try {
      if (localStorage.getItem('cifra-app:strip') === '0') setStripOpen(false);
    } catch {}
  }, []);
  const toggleStrip = () =>
    setStripOpen((v) => {
      try {
        localStorage.setItem('cifra-app:strip', v ? '0' : '1');
      } catch {}
      return !v;
    });

  const auto = useAutoScroll(scrollRef, { enabled: prefs.columns === 1 });
  const bpm = song?.bpm ?? 80;
  const beatsPerBar = parseInt(song?.timeSignature ?? '4', 10) || 4;
  const metro = useMetronome(bpm, beatsPerBar, metroOn);

  /* ---- repertório: anterior / próxima ---- */
  const idx = setlist ? setlist.songIds.indexOf(songId) : -1;
  const prevId = setlist && idx > 0 ? setlist.songIds[idx - 1] : undefined;
  const nextId = setlist && idx >= 0 && idx < setlist.songIds.length - 1 ? setlist.songIds[idx + 1] : undefined;
  const go = useCallback(
    (id?: string) => {
      if (id && setlistId) router.push(`/song/${id}?setlist=${setlistId}${present ? '&present=1' : ''}`);
    },
    [router, setlistId, present],
  );

  /* ---- atalhos de teclado ---- */
  useEffect(() => {
    if (present) return; // no modo apresentação quem manda é o Presenter
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        auto.toggle();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        auto.changeSpeed(1);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        auto.changeSpeed(-1);
      } else if (e.key === 'ArrowRight') go(nextId);
      else if (e.key === 'ArrowLeft') go(prevId);
    };
    const onKeyUp = (e: KeyboardEvent) => e.code === 'Space' && e.preventDefault();
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [auto, go, nextId, prevId, present]);

  /* ---- swipe entre músicas do repertório ---- */
  const touch = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = touch.current;
    touch.current = null;
    if (!s) return;
    const dx = e.changedTouches[0].clientX - s.x;
    const dy = e.changedTouches[0].clientY - s.y;
    if (Math.abs(dx) > 90 && Math.abs(dx) > Math.abs(dy) * 2) go(dx < 0 ? nextId : prevId);
  };

  /* ---- tela sempre acesa durante o uso ---- */
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<typeof lock> } }).wakeLock
      ?.request('screen')
      .then((l) => (lock = l))
      .catch(() => {});
    return () => void lock?.release().catch(() => {});
  }, []);

  const keys = useMemo(() => (song ? getKeys(song) : null), [song]);

  if (!hydrated) return <div className="p-6 text-muted" suppressHydrationWarning>Carregando…</div>;
  if (!song || !keys) {
    return (
      <div className="p-6">
        <p className="mb-3">Cifra não encontrada.</p>
        <Link href="/" className="text-accent underline">Voltar à biblioteca</Link>
      </div>
    );
  }

  const transpose = (n: number) => updateSong(song.id, { currentKey: transposeKey(song.currentKey, n) });
  const two = prefs.columns === 2;

  if (present) {
    return (
      <Presenter
        song={song}
        setlistName={setlist?.name}
        prevId={prevId}
        nextId={nextId}
        onGo={(id) => go(id)}
        onPick={(id) => router.push(`/song/${id}?${setlist?.songIds.includes(id) ? `setlist=${setlistId}&` : ''}present=1`)}
        onExit={() => setPresent(false)}
      />
    );
  }

  return (
    <div className="reader-root flex h-dvh flex-col" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <PulseBar tick={metro.tick} beat={metro.beat} />

      {/* ---------------- barra superior ---------------- */}
      {focus ? (
        <button
          onClick={() => setFocus(false)}
          className="no-print fixed right-3 top-3 z-30 inline-flex items-center gap-1.5 rounded-full border border-line bg-card px-4 py-2 text-sm font-semibold shadow-soft"
        >
          <Minimize2 size={15} /> Mostrar barra
        </button>
      ) : (
        <header className="no-print shrink-0 border-b border-line bg-card/90 backdrop-blur-md">
          <div className="mx-auto flex max-w-6xl items-center gap-1.5 px-3 py-2 sm:gap-2 sm:px-4 sm:py-2.5">
            <Link href="/" aria-label="Biblioteca" title="Voltar à biblioteca" className={iconBtn}>
              <ArrowLeft size={18} />
            </Link>
            <div className="min-w-0 flex-1 px-1">
              <h1 className="truncate font-display text-base font-bold leading-tight">{song.title}</h1>
              <p className="truncate text-xs text-muted">
                {song.artist || 'Sem artista'}
                {song.variantOf && ' · Minha versão'}
                {setlist && ` · ${setlist.name}`}
              </p>
            </div>

            {setlist && idx >= 0 && (
              <div className="hidden items-center gap-1 sm:flex">
                <button onClick={() => go(prevId)} disabled={!prevId} aria-label="Música anterior" className={iconBtn}><ChevronLeft size={18} /></button>
                <span className="min-w-[3.2rem] text-center text-sm font-semibold tabular-nums text-muted">{idx + 1}/{setlist.songIds.length}</span>
                <button onClick={() => go(nextId)} disabled={!nextId} aria-label="Próxima música" className={iconBtn}><ChevronRight size={18} /></button>
              </div>
            )}

            {isAdmin && <Link href={`/song/${song.id}/edit`} aria-label="Editar cifra" title="Editar cifra" className={iconBtn}><Pencil size={16} /></Link>}
            <button
              onClick={() => setPresent(true)}
              title="Modo apresentação: só a cifra, controlada por pedal de 3 botões"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center gap-2 rounded-full border border-accent bg-accent text-sm font-bold sm:h-10 sm:w-auto sm:px-4 text-accentfg shadow-soft transition hover:brightness-110 active:scale-95"
            >
              <Presentation size={16} /> <span className="hidden sm:inline">Apresentar</span>
            </button>
            <button onClick={() => setFocus(true)} aria-label="Tela limpa" title="Tela limpa: esconde a barra" className={iconBtn}><Maximize2 size={16} /></button>
            <button
              onClick={toggleStrip}
              aria-label={stripOpen ? 'Minimizar controles do topo' : 'Mostrar controles do topo'}
              title={stripOpen ? 'Minimizar controles' : 'Mostrar controles (Tom, Capo, Simplificar…)'}
              className={iconBtn}
            >
              {stripOpen ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
            </button>
            <button onClick={() => setDrawer(true)} aria-label="Ajustes" title="Ajustes" className={iconBtn}><SlidersHorizontal size={16} /></button>
          </div>

          {/* faixa de controles: tudo em uma linha, cada item com seu nome */}
          <div className={cn('mx-auto max-w-6xl flex-wrap items-center gap-2 px-3 pb-2.5 sm:flex-nowrap sm:overflow-x-auto sm:px-4 sm:pb-3', stripOpen ? 'flex' : 'hidden')}>
            {setlist && idx >= 0 && (
              <div className="inline-flex shrink-0 items-center gap-1 rounded-full border border-line bg-card p-1 sm:hidden">
                <button onClick={() => go(prevId)} disabled={!prevId} aria-label="Música anterior" className="h-8 w-8 rounded-full disabled:opacity-30"><ChevronLeft size={16} className="mx-auto" /></button>
                <span className="text-xs font-bold tabular-nums text-muted">{idx + 1}/{setlist.songIds.length}</span>
                <button onClick={() => go(nextId)} disabled={!nextId} aria-label="Próxima música" className="h-8 w-8 rounded-full disabled:opacity-30"><ChevronRight size={16} className="mx-auto" /></button>
              </div>
            )}
            <div className="inline-flex shrink-0 items-center gap-1 rounded-full border border-line bg-card p-1">
              <span className="pl-3 pr-1 text-xs font-semibold text-muted">Tom</span>
              <button onClick={() => transpose(-1)} aria-label="Meio tom abaixo" className="h-8 w-8 rounded-full text-lg font-bold hover:bg-accent/10">−</button>
              <span className="min-w-[2.6rem] text-center font-display text-lg font-extrabold text-chord">{keys.sounding}</span>
              <button onClick={() => transpose(1)} aria-label="Meio tom acima" className="h-8 w-8 rounded-full text-lg font-bold hover:bg-accent/10">+</button>
              {keys.steps !== 0 && (
                <button
                  onClick={() => updateSong(song.id, { currentKey: song.originalKey })}
                  title={`Voltar ao tom original (${keys.original})`}
                  className="inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-xs font-semibold text-muted hover:bg-accent/10 hover:text-ink"
                >
                  <RotateCcw size={12} /> {keys.original}
                </button>
              )}
            </div>

            <label className="inline-flex shrink-0 items-center gap-1 rounded-full border border-line bg-card py-1 pl-3.5 pr-1">
              <span className="text-xs font-semibold text-muted">Capo</span>
              <select
                value={song.capo}
                onChange={(e) => updateSong(song.id, { capo: Number(e.target.value) })}
                className="h-8 cursor-pointer rounded-full bg-transparent px-2 text-sm font-semibold text-ink outline-none hover:bg-accent/10"
              >
                <option value={0}>sem</option>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>{n}ª casa</option>
                ))}
              </select>
            </label>

            <Toggle
              checked={prefs.simplified}
              onChange={(v) => setPrefs({ simplified: v })}
              label="Simplificar"
              title="Troca acordes com extensões por versões básicas (mantém a sétima dominante, como A7)"
            />

            <Seg
              value={prefs.viewMode}
              onChange={(v) => setPrefs({ viewMode: v })}
              options={[
                { value: 'full', label: 'Letra e cifra' },
                { value: 'compact', label: 'Só acordes', title: 'Modo palco/bateria: só os blocos e a harmonia' },
              ]}
            />
            <Seg
              value={prefs.columns}
              onChange={(v) => setPrefs({ columns: v })}
              options={[
                { value: 1, label: '1 coluna', title: 'Uma coluna, com rolagem' },
                { value: 2, label: <><Columns2 size={15} /> 2 colunas</>, title: 'Duas colunas, sem rolagem' },
              ]}
            />
          </div>
        </header>
      )}

      {/* cabeçalho só na impressão */}
      <div className="print-only px-4 pt-4">
        <h1 className="text-2xl font-bold">{song.title}</h1>
        <p className="text-sm">
          {song.artist} — Tom {keys.sounding}
          {song.capo > 0 && ` · Capo ${song.capo}ª casa (formato ${keys.shape})`}
        </p>
      </div>

      <main
        ref={scrollRef}
        className={cn('reader-main relative min-h-0 flex-1', two ? 'overflow-hidden' : 'overflow-y-auto')}
      >
        {two ? (
          <div className="absolute inset-0 px-6 py-5 lg:pr-48">
            <SongView song={song} prefs={prefs} columns={2} mode={prefs.viewMode} />
          </div>
        ) : (
          <div className="rise mx-auto max-w-3xl px-4 pb-40 pt-6 sm:px-6 sm:pb-48 sm:pt-8">
            <div className="mb-9">
              <p className="mb-2 font-display text-xs font-bold uppercase tracking-[0.22em] text-accent">
                {setlist ? setlist.name : song.variantOf ? 'Minha versão' : 'Cifra'}
              </p>
              <h2 className="font-display text-3xl font-extrabold leading-[1.05] tracking-tight [text-wrap:balance] sm:text-5xl">
                {song.title}
              </h2>
              {song.artist && <p className="mt-2 text-lg text-muted">{song.artist}</p>}
              <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                <span className="rounded-full bg-chord/15 px-3 py-1 font-bold text-chord">Tom {keys.sounding}</span>
                {song.capo > 0 && (
                  <span className="rounded-full bg-accent/15 px-3 py-1 font-semibold text-accent">
                    Capo {song.capo}ª casa · toque em {keys.shape}
                  </span>
                )}
                {song.bpm && <span className="rounded-full bg-line/70 px-3 py-1 font-semibold text-muted">{song.bpm} BPM</span>}
                {song.tuning && <span className="rounded-full bg-line/70 px-3 py-1 font-semibold text-muted">{song.tuning}</span>}
                {keys.steps !== 0 && <span className="text-xs text-muted">original em {keys.original}</span>}
              </div>
            </div>
            <SongView song={song} prefs={prefs} columns={1} mode={prefs.viewMode} />
          </div>
        )}
      </main>

      <Dock
        showScroll={!two}
        scrolling={auto.playing}
        speed={auto.speed}
        onToggleScroll={auto.toggle}
        onSpeed={auto.setSpeed}
        bpm={bpm}
        beat={metro.beat}
        beatsPerBar={beatsPerBar}
        metroOn={metroOn}
        onBpm={(v) => updateSong(song.id, { bpm: v })}
        onToggleMetro={() => setMetroOn((v) => !v)}
      />
      <SettingsDrawer open={drawer} onClose={() => setDrawer(false)} />
    </div>
  );
}
