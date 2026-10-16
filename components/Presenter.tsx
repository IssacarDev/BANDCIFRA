'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Scissors, Smartphone, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Expand, Settings2, X } from 'lucide-react';
import { useStore } from '@/lib/store';
import { useAuth } from '@/lib/auth';
import { DEFAULT_PEDAL } from '@/lib/store';
import { getKeys, transposeKey } from '@/lib/chords';
import {
  HOLD_MS, MODE_NAMES, MODE_SHORT, FONT_STEP, actionLabels, clampFont, handlePedal, initialPedal, keyLabel,
  midiLabel, midiPress, midiRelease, type PedalAction, type PedalButton, type PedalState, type PresentMode,
} from '@/lib/presenter';
import type { PedalConfig, Song } from '@/types/song';
import SongView from './SongView';
import RemotePanel from './RemotePanel';
import { useRemoteHost } from '@/hooks/useRemote';
import { loadCode, type RemoteCmd, type RemoteState } from '@/lib/remoteProto';
import { Btn, Seg, Toggle } from './ui';
import { cn } from '@/lib/utils';

type Side = 'left' | 'middle' | 'right';
const SIDE_NAMES: Record<Side, string> = { left: 'Esquerdo', middle: 'Meio', right: 'Direito' };
const GAP = 48;

interface Props {
  song: Song;
  setlistName?: string;
  prevId?: string;
  nextId?: string;
  onGo: (id: string) => void;
  /** abre outra música (qualquer uma da biblioteca) já em modo apresentação */
  onPick: (id: string) => void;
  onExit: () => void;
}

export default function Presenter({ song, setlistName, prevId, nextId, onGo, onPick, onExit }: Props) {
  const allSongs = useStore((s) => s.songs);
  const prefs = useStore((s) => s.prefs);
  const setPrefs = useStore((s) => s.setPrefs);
  const updateSong = useStore((s) => s.updateSong);
  const pedal = prefs.pedal;
  const keys = useMemo(() => getKeys(song), [song]);

  const stageRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(1);
  const [mode, setMode] = useState<PresentMode>(1);
  const [stale, setStale] = useState(false);
  const [setup, setSetup] = useState(false);
  const [learning, setLearning] = useState<Side | null>(null);
  const [midiStatus, setMidiStatus] = useState('');
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const [heldMiddle, setHeldMiddle] = useState(false);
  const [heldRight, setHeldRight] = useState(false);
  const isAdmin = useAuth((s) => s.isAdmin);
  const [editing, setEditing] = useState(false);
  const [remoteOpen, setRemoteOpen] = useState(false);
  const [code, setCode] = useState('');
  useEffect(() => setCode(loadCode()), []);
  const [draft, setDraft] = useState<string[]>([]);
  const autoKeys = useRef<string[]>([]);
  const [hdrOpen, setHdrOpen] = useState(true);
  const [ftrOpen, setFtrOpen] = useState(true);
  useEffect(() => {
    try {
      if (localStorage.getItem('cifra-app:phdr') === '0') setHdrOpen(false);
      if (localStorage.getItem('cifra-app:pftr') === '0') setFtrOpen(false);
    } catch {}
  }, []);
  const remember = (k: string, v: boolean) => {
    try {
      localStorage.setItem(k, v ? '1' : '0');
    } catch {}
  };

  /* ---- medida da área da cifra ---- */
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => setSize({ w: Math.max(0, el.clientWidth - 48), h: Math.max(0, el.clientHeight - 32) });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const cols: 1 | 2 = 1;
  const pageW = Math.min(size.w, 1000); // coluna centralizada, com largura boa de leitura

  /* ---- estado "vivo" lido pelos handlers de entrada ---- */
  const pedalState = useRef<PedalState>(initialPedal(Date.now()));
  const editingRef = useRef(false);
  editingRef.current = editing;
  const remoteRef = useRef(false);
  remoteRef.current = remoteOpen;
  const [pick, setPick] = useState(0);
  const live = useRef({ song, prefs, page, pages, prevId, nextId, learning, setup: false, pick, allSongs });
  live.current = { song, prefs, page, pages, prevId, nextId, learning, setup: setup || editing || remoteOpen, pick, allSongs };

  const flash = useCallback((text: string) => setToast({ id: Date.now(), text }), []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1400);
    return () => clearTimeout(t);
  }, [toast]);

  /* indica quando o próximo toque lateral vai voltar ao modo 1 */
  useEffect(() => {
    const t = setInterval(() => {
      const st = pedalState.current;
      setStale(st.mode !== 1 && Date.now() - st.lastActivity > live.current.prefs.pedal.idleSeconds * 1000);
    }, 500);
    return () => clearInterval(t);
  }, []);

  const run = useCallback(
    (a: PedalAction) => {
      const { song: sg, prefs: pf, page: pg, pages: total, prevId: pv, nextId: nx } = live.current;
      switch (a.type) {
        case 'page':
          if (a.dir === 1) {
            if (pg < total - 1) setPage(pg + 1);
            else if (nx) onGo(nx);
            else flash('Fim da cifra');
          } else if (pg > 0) setPage(pg - 1);
          else if (pv) onGo(pv);
          else flash('Início da cifra');
          break;
        case 'transpose': {
          const k = transposeKey(sg.currentKey, a.dir);
          updateSong(sg.id, { currentKey: k });
          flash(`Tom ${getKeys({ ...sg, currentKey: k }).sounding}`);
          break;
        }
        case 'simplify':
          setPrefs({ simplified: a.value });
          flash(a.value ? 'Cifra simplificada' : 'Cifra original');
          break;
        case 'pick': {
          const n = live.current.allSongs.length;
          if (n) setPick((i) => Math.min(n - 1, Math.max(0, i + a.dir)));
          break;
        }
        case 'pickConfirm': {
          const target = live.current.allSongs[live.current.pick];
          if (target && target.id !== live.current.song.id) onPick(target.id);
          break;
        }
        case 'font': {
          const f = clampFont(pf.fontSize + a.dir * FONT_STEP);
          const ratio = pf.chordSize / pf.fontSize;
          setPrefs({ fontSize: f, chordSize: Math.round(f * ratio) });
          flash(`Fonte ${f}`);
          break;
        }
      }
    },
    [flash, onGo, onPick, setPrefs, updateSong],
  );

  const dispatch = useCallback(
    (b: PedalButton) => {
      const r = handlePedal(b, Date.now(), pedalState.current, live.current.prefs.pedal.idleSeconds * 1000);
      const modeChanged = r.state.mode !== pedalState.current.mode;
      pedalState.current = r.state;
      setStale(false);
      if (modeChanged) {
        if (r.state.mode === 5) setPick(Math.max(0, live.current.allSongs.findIndex((x) => x.id === live.current.song.id)));
        setMode(r.state.mode);
        flash(`Modo ${r.state.mode} · ${MODE_NAMES[r.state.mode]}`);
      }
      run(r.action);
    },
    [flash, run],
  );

  /* ---- segurar: meio (volta ao modo 1) · direito no modo 5 (abre a música destacada) ---- */
  const holdTimers = useRef<Partial<Record<Side, ReturnType<typeof setTimeout> | null>>>({});
  const midiHasRelease = useRef(false);

  const press = useCallback(
    (side: Side, phase: 'down' | 'up', opts?: { instant?: boolean }) => {
      const timers = holdTimers.current;
      if (phase === 'up') {
        if (timers[side]) {
          clearTimeout(timers[side]!);
          timers[side] = null;
          if (side === 'middle') setHeldMiddle(false);
          else setHeldRight(false);
          dispatch(side);
        }
        return;
      }
      const holdable = side === 'middle' || (side === 'right' && pedalState.current.mode === 5);
      if (!holdable || opts?.instant) {
        dispatch(side);
        return;
      }
      if (timers[side]) return;
      if (side === 'middle') setHeldMiddle(true);
      else setHeldRight(true);
      timers[side] = setTimeout(() => {
        timers[side] = null;
        if (side === 'middle') setHeldMiddle(false);
        else setHeldRight(false);
        dispatch(side === 'middle' ? 'middleHold' : 'rightHold');
      }, HOLD_MS);
    },
    [dispatch],
  );
  /** toque rápido (clique, deslizar): aperta e solta */
  const tap = useCallback(
    (side: Side) => {
      press(side, 'down');
      press(side, 'up');
    },
    [press],
  );
  useEffect(() => () => Object.values(holdTimers.current).forEach((t) => t && clearTimeout(t)), []);

  /* ---- gravar tecla / MIDI de um botão ---- */
  const savePedal = useCallback((patch: Partial<PedalConfig>) => setPrefs({ pedal: { ...live.current.prefs.pedal, ...patch } }), [setPrefs]);
  const learnKey = useCallback(
    (side: Side, code: string) => {
      const p = live.current.prefs.pedal;
      savePedal({ keys: { ...p.keys, [side]: code } });
      setLearning(null);
    },
    [savePedal],
  );
  const learnMidi = useCallback(
    (side: Side, sig: string) => {
      const p = live.current.prefs.pedal;
      savePedal({ midi: { ...p.midi, [side]: sig } });
      setLearning(null);
    },
    [savePedal],
  );

  /* ---- teclado / pedal USB ou Bluetooth ---- */
  useEffect(() => {
    const sideOf = (code: string): Side | null => {
      const k = live.current.prefs.pedal.keys;
      if (code === k.left) return 'left';
      if (code === k.middle) return 'middle';
      if (code === k.right) return 'right';
      if (code === 'PageUp') return 'left'; // apresentadores (clickers) mandam PageUp/PageDown
      if (code === 'PageDown') return 'right';
      return null;
    };
    const typing = (e: KeyboardEvent) => ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName);
    const onDown = (e: KeyboardEvent) => {
      const { learning: L, setup: S } = live.current;
      if (L) {
        e.preventDefault();
        e.stopPropagation();
        if (e.code === 'Escape') setLearning(null);
        else learnKey(L, e.code);
        return;
      }
      if (typing(e)) return;
      if (e.code === 'Escape') {
        e.preventDefault();
        if (remoteRef.current) setRemoteOpen(false);
        else if (editingRef.current) setEditing(false);
        else if (S) setSetup(false);
        else onExit();
        return;
      }
      const side = sideOf(e.code);
      if (!side) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.repeat) return;
      if (S) return; // com o painel aberto o pedal não mexe na cifra
      press(side, 'down');
    };
    const onUp = (e: KeyboardEvent) => {
      if (live.current.learning || typing(e)) return;
      const side = sideOf(e.code);
      if (!side) return;
      e.preventDefault();
      if (!live.current.setup) press(side, 'up');
    };
    window.addEventListener('keydown', onDown, true);
    window.addEventListener('keyup', onUp, true);
    return () => {
      window.removeEventListener('keydown', onDown, true);
      window.removeEventListener('keyup', onUp, true);
    };
  }, [learnKey, onExit, press]);

  /* ---- pedal MIDI (Web MIDI) ---- */
  useEffect(() => {
    if (!pedal.midi.enabled) {
      setMidiStatus('');
      return;
    }
    const nav = navigator as Navigator & { requestMIDIAccess?: () => Promise<MIDIAccess> };
    if (!nav.requestMIDIAccess) {
      setMidiStatus('Este navegador não tem MIDI (use Chrome ou Edge).');
      return;
    }
    let access: MIDIAccess | null = null;
    let dead = false;
    const onMsg = (ev: MIDIMessageEvent) => {
      const data = ev.data;
      if (!data) return;
      const sig = midiPress(data);
      const rel = midiRelease(data);
      const m = live.current.prefs.pedal.midi;
      const L = live.current.learning;
      if (sig && L) return learnMidi(L, sig);
      if (live.current.setup) return;
      if (sig) {
        if (sig === m.left) press('left', 'down');
        else if (sig === m.right) press('right', 'down', { instant: !midiHasRelease.current });
        else if (sig === m.middle) press('middle', 'down', { instant: !midiHasRelease.current });
      } else if (rel) {
        midiHasRelease.current = true;
        if (rel === m.middle) press('middle', 'up');
        else if (rel === m.right) press('right', 'up');
      }
    };
    const attach = () => {
      if (!access) return;
      let n = 0;
      access.inputs.forEach((inp) => {
        inp.onmidimessage = onMsg;
        n++;
      });
      setMidiStatus(n ? `${n} dispositivo(s) MIDI conectado(s)` : 'Nenhum dispositivo MIDI encontrado.');
    };
    nav
      .requestMIDIAccess()
      .then((a) => {
        if (dead) return;
        access = a;
        a.onstatechange = attach;
        attach();
      })
      .catch(() => !dead && setMidiStatus('Permissão de MIDI negada.'));
    return () => {
      dead = true;
      access?.inputs.forEach((inp) => (inp.onmidimessage = null));
      if (access) access.onstatechange = null;
    };
  }, [pedal.midi.enabled, learnMidi, press]);

  /* ---- controle remoto (outro celular) ---- */
  const setModeDirect = useCallback(
    (m: PresentMode) => {
      pedalState.current = { ...pedalState.current, mode: m, lastActivity: Date.now() };
      if (m === 5) setPick(Math.max(0, live.current.allSongs.findIndex((x) => x.id === live.current.song.id)));
      setMode(m);
      setStale(false);
      flash(`Modo ${m} · ${MODE_NAMES[m]}`);
    },
    [flash],
  );

  const onRemote = useCallback(
    (c: RemoteCmd) => {
      if (editingRef.current) return;
      const L = live.current;
      switch (c.k) {
        case 'press': press(c.side, c.phase); break;
        case 'transpose': run({ type: 'transpose', dir: c.dir }); break;
        case 'simplify': run({ type: 'simplify', value: !L.prefs.simplified }); break;
        case 'font': run({ type: 'font', dir: c.dir }); break;
        case 'mode': setModeDirect(c.mode); break;
        case 'song': if (c.id !== L.song.id) onPick(c.id); break;
        case 'nextSong': if (L.nextId) onGo(L.nextId); else flash('Última música do repertório'); break;
        case 'prevSong': if (L.prevId) onGo(L.prevId); else flash('Primeira música do repertório'); break;
        case 'page': run({ type: 'page', dir: c.dir }); break;
        case 'exit': onExit(); break;
      }
    },
    [flash, onExit, onGo, onPick, press, run, setModeDirect],
  );

  const remoteState: RemoteState = {
    songId: song.id,
    title: song.title,
    artist: song.artist,
    key: keys.sounding,
    capo: song.capo,
    simplified: prefs.simplified,
    fontSize: prefs.fontSize,
    mode,
    page,
    pages,
    pick,
    hasPrev: !!prevId,
    hasNext: !!nextId,
    songs: allSongs.map((x) => ({ id: x.id, title: x.title, artist: x.artist, key: x.currentKey })),
  };
  const { controllers } = useRemoteHost(code, remoteState, onRemote);
  const prevControllers = useRef(0);
  useEffect(() => {
    if (controllers > prevControllers.current) flash('Controle conectado');
    prevControllers.current = controllers;
  }, [controllers, flash]);

  /* ---- toque nas laterais / deslize ---- */
  const touch = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY });
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = touch.current;
    touch.current = null;
    if (!s) return;
    const dx = e.changedTouches[0].clientX - s.x;
    const dy = e.changedTouches[0].clientY - s.y;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) tap(dx < 0 ? 'right' : 'left');
  };

  const onMeasure = useCallback(
    (n: number) => {
      setPages(n);
      setPage((p) => Math.min(p, n - 1));
    },
    [],
  );

  const fullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => {});
  };

  const labels = actionLabels(mode);
  const nextMode = (mode === 5 ? 1 : mode + 1) as PresentMode;

  return (
    <div className="fixed inset-0 z-50 flex select-none flex-col bg-surface text-ink" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {/* ---------- topo mínimo ---------- */}
      {hdrOpen ? (
      <header className="shrink-0 border-b border-line bg-card/80 px-3 py-2 backdrop-blur-md sm:px-4">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-base font-bold leading-tight">{song.title}</h1>
            <p className="truncate text-xs text-muted">
              {song.artist || 'Sem artista'}
              {setlistName && ` · ${setlistName}`}
            </p>
          </div>
          <span className="rounded-full bg-chord/15 px-3 py-1 text-sm font-bold text-chord">Tom {keys.sounding}</span>
          {song.capo > 0 && (
            <span className="hidden rounded-full bg-accent/15 px-3 py-1 text-sm font-semibold text-accent sm:inline">
              Capo {song.capo} · {keys.shape}
            </span>
          )}
          {prefs.simplified && <span className="hidden rounded-full bg-line/70 px-3 py-1 text-sm font-semibold text-muted sm:inline">Simplificada</span>}
          <button onClick={() => setRemoteOpen(true)} aria-label="Controle pelo celular" title="Controlar de outro celular (QR Code)" className={cn(ibtn, 'relative')}>
            <Smartphone size={16} />
            {controllers > 0 && <span className="absolute right-0.5 top-0.5 h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-card" />}
          </button>
          {isAdmin && (
            <button
              onClick={() => { setDraft(song.pageBreaks?.length ? song.pageBreaks : autoKeys.current); setEditing(true); }}
              aria-label="Editar páginas"
              title="Admin: escolher onde cada página termina"
              className={ibtn}
            >
              <Scissors size={16} />
            </button>
          )}
          <button onClick={() => { setHdrOpen(false); remember('cifra-app:phdr', false); }} aria-label="Minimizar topo" title="Minimizar topo" className={ibtn}><ChevronUp size={17} /></button>
          <button onClick={() => setSetup(true)} aria-label="Controles" title="Controles da apresentação" className={ibtn}><Settings2 size={17} /></button>
          <button onClick={fullscreen} aria-label="Tela cheia" title="Tela cheia" className={ibtn}><Expand size={16} /></button>
          <button onClick={onExit} aria-label="Sair da apresentação" title="Sair (Esc)" className={ibtn}><X size={18} /></button>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
          {([1, 2, 3, 4, 5] as PresentMode[]).map((m) => (
            <span
              key={m}
              className={cn(
                'inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1 text-sm font-semibold transition',
                m === mode ? 'border-accent bg-accent text-accentfg shadow-soft' : 'border-line text-muted',
              )}
            >
              <span className={cn('grid h-5 w-5 place-items-center rounded-full text-xs font-extrabold', m === mode ? 'bg-accentfg/20' : 'bg-line')}>{m}</span>
              <span className={cn(m !== mode && 'hidden sm:inline')}>{MODE_NAMES[m]}</span>
            </span>
          ))}
          <span className="w-full text-xs text-muted sm:ml-auto sm:w-auto">
            {stale ? 'Parado há um tempo: o próximo toque lateral volta à Cifra e já passa' : labels.hint}
          </span>
        </div>
      </header>
      ) : (
      <button
        onClick={() => { setHdrOpen(true); remember('cifra-app:phdr', true); }}
        aria-label="Mostrar topo"
        title="Mostrar topo"
        className={cn(bubble, 'right-3 top-3')}
      >
        <ChevronDown size={18} />
      </button>
      )}

      {/* ---------- cifra em páginas laterais ---------- */}
      <div ref={stageRef} className="relative min-h-0 flex-1">
        <div className="absolute inset-0 flex justify-center py-4">
         <div className="h-full overflow-hidden px-6" style={{ width: pageW + 48 }}>
          {size.w > 0 && size.h > 0 && (
            <SongView
              song={song}
              prefs={prefs}
              columns="pages"
              mode={prefs.viewMode}
              interactive={false}
              breakKeys={song.pageBreaks}
              onAutoBreaks={(k) => (autoKeys.current = k)}
              paged={{ cols, gap: GAP, width: pageW, height: size.h, page, onMeasure }}
            />
          )}
         </div>
        </div>

        {pedal.tapZones && (
          <>
            <button aria-label="Voltar" onClick={() => tap('left')} className="absolute inset-y-0 left-0 z-10 w-[18%] cursor-pointer bg-transparent" tabIndex={-1} />
            <button aria-label="Avançar" onClick={() => tap('right')} className="absolute inset-y-0 right-0 z-10 w-[18%] cursor-pointer bg-transparent" tabIndex={-1} />
          </>
        )}

        {mode === 5 && (
          <SongPicker
            songs={allSongs}
            index={pick}
            currentId={song.id}
            onHover={setPick}
            onChoose={(id) => {
              pedalState.current = { ...pedalState.current, mode: 1, lastActivity: Date.now() };
              setMode(1);
              if (id !== song.id) onPick(id);
            }}
          />
        )}

        {toast && (
          <div key={toast.id} className="rise pointer-events-none absolute left-1/2 top-4 z-20 -translate-x-1/2 rounded-full bg-accent px-5 py-2 font-display text-lg font-extrabold text-accentfg shadow-lift">
            {toast.text}
          </div>
        )}
      </div>

      {/* ---------- rodapé: páginas + pedal na tela ---------- */}
      {ftrOpen ? (
      <footer className="shrink-0 border-t border-line bg-card/80 px-3 pb-[max(0.25rem,env(safe-area-inset-bottom))] pt-1 backdrop-blur-md sm:px-4">
        <div className={cn('flex items-center justify-center gap-1.5', ftrOpen && 'mb-2 pt-1')}>
          {Array.from({ length: pages }, (_, i) => (
            <span key={i} className={cn('h-2 rounded-full transition-all', i === page ? 'w-6 bg-accent' : 'w-2 bg-line')} />
          ))}
          <span className="ml-2 text-xs font-semibold tabular-nums text-muted">{page + 1}/{pages}</span>
          <button
            onClick={() => { setFtrOpen((v) => { remember('cifra-app:pftr', !v); return !v; }); }}
            aria-label={ftrOpen ? 'Minimizar botões' : 'Mostrar botões'}
            title={ftrOpen ? 'Minimizar botões' : 'Mostrar botões'}
            className={cn(ibtnSm, 'ml-2')}
          >
            {ftrOpen ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
        </div>
        {ftrOpen && pedal.screenButtons && (
          <div className="mx-auto grid max-w-3xl grid-cols-[1fr_1.3fr_1fr] gap-2 pb-1">
            <button onClick={() => tap('left')} className={pedalBtn}>
              <ChevronLeft size={22} />
              <span>{labels.left}</span>
            </button>
            <button
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                press('middle', 'down');
              }}
              onPointerUp={() => press('middle', 'up')}
              onPointerCancel={() => press('middle', 'up')}
              onContextMenu={(e) => e.preventDefault()}
              className={cn(pedalBtn, 'touch-none flex-col gap-0 border-accent/50 bg-accent/10', heldMiddle && 'bg-accent text-accentfg')}
            >
              <span className={cn('whitespace-nowrap text-[11px] font-extrabold uppercase tracking-wider sm:text-sm sm:tracking-widest', heldMiddle ? '' : 'text-accent')}>{heldMiddle ? 'segurando…' : <>Modo {mode} · <span className="sm:hidden">{MODE_SHORT[mode]}</span><span className="hidden sm:inline">{MODE_NAMES[mode]}</span></>}</span>
              <span className="hidden text-xs font-semibold opacity-70 sm:block">toque: {MODE_NAMES[nextMode]} · segure: Cifra</span>
            </button>
            <button
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                press('right', 'down');
              }}
              onPointerUp={() => press('right', 'up')}
              onPointerCancel={() => press('right', 'up')}
              onContextMenu={(e) => e.preventDefault()}
              className={cn(pedalBtn, 'touch-none', heldRight && 'bg-accent text-accentfg')}
            >
              <span>{labels.right}</span>
              <ChevronRight size={22} />
            </button>
          </div>
        )}
      </footer>
      ) : (
      <button
        onClick={() => { setFtrOpen(true); remember('cifra-app:pftr', true); }}
        aria-label="Mostrar botões"
        title="Mostrar botões"
        className={cn(bubble, 'bottom-3 right-3')}
      >
        <ChevronUp size={18} />
      </button>
      )}

      {editing && (
        <div className="absolute inset-0 z-40 flex flex-col bg-surface">
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-line bg-card px-3 py-2">
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-base font-extrabold">Editar páginas</h2>
              <p className="text-xs text-muted">Toque entre as linhas para começar uma nova página ali. Toque numa quebra para tirá-la.</p>
            </div>
            <Btn onClick={() => setDraft(autoKeys.current)} title="Usa a divisão automática como ponto de partida" className="min-h-9 px-3 py-1.5">Automático</Btn>
            <Btn onClick={() => setEditing(false)} className="min-h-9 px-3 py-1.5">Cancelar</Btn>
            <Btn
              variant="solid"
              onClick={() => {
                updateSong(song.id, { pageBreaks: draft.length ? draft : undefined });
                setPage(0);
                setEditing(false);
                flash('Páginas salvas');
              }}
              className="min-h-9 px-4 py-1.5"
            >
              Salvar
            </Btn>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            <div className="mx-auto" style={{ width: Math.min(pageW, 1000) || undefined, maxWidth: '100%' }}>
              <SongView
                song={song}
                prefs={prefs}
                columns={1}
                mode={prefs.viewMode}
                interactive={false}
                breakEdit={{
                  breaks: draft,
                  toggle: (k) => setDraft((d) => (d.includes(k) ? d.filter((x) => x !== k) : [...d, k])),
                }}
              />
            </div>
          </div>
        </div>
      )}

      {remoteOpen && code && <RemotePanel code={code} controllers={controllers} onClose={() => setRemoteOpen(false)} />}

      {setup && (
        <SetupPanel
          pedal={pedal}
          learning={learning}
          midiStatus={midiStatus}
          viewMode={prefs.viewMode}
          onViewMode={(v) => setPrefs({ viewMode: v })}
          onLearn={(s) => setLearning((l) => (l === s ? null : s))}
          onChange={savePedal}
          onClose={() => {
            setLearning(null);
            setSetup(false);
          }}
        />
      )}
    </div>
  );
}

const ibtn =
  'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-card text-ink transition hover:border-accent/50 hover:bg-accent/10 active:scale-95';
const bubble =
  'absolute z-40 inline-flex h-11 w-11 items-center justify-center rounded-full border border-line bg-card/80 text-ink opacity-70 shadow-soft backdrop-blur-md transition hover:opacity-100 active:scale-95';
const ibtnSm =
  'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line bg-card text-ink transition hover:bg-accent/10 active:scale-95';
const pedalBtn =
  'inline-flex min-h-16 items-center justify-center gap-1 rounded-2xl border border-line bg-card px-2 font-display text-sm sm:gap-2 sm:px-3 sm:text-base font-extrabold transition hover:border-accent/50 hover:bg-accent/10 active:scale-[0.97] select-none';

/* ------------------------------------------------------------------ */

function SetupPanel({
  pedal, learning, midiStatus, viewMode, onViewMode, onLearn, onChange, onClose,
}: {
  pedal: PedalConfig;
  learning: Side | null;
  midiStatus: string;
  viewMode: 'full' | 'compact';
  onViewMode: (v: 'full' | 'compact') => void;
  onLearn: (s: Side) => void;
  onChange: (p: Partial<PedalConfig>) => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute inset-0 z-30 flex justify-end bg-black/50" onClick={onClose}>
      <aside
        className="h-full w-full max-w-md overflow-y-auto border-l border-line bg-card p-5 shadow-lift"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-extrabold">Controle da apresentação</h2>
          <button onClick={onClose} aria-label="Fechar" className={ibtn}><X size={17} /></button>
        </div>

        <p className="mb-5 text-sm text-muted">
          Escolha de onde a apresentação é controlada. Pode ligar várias fontes ao mesmo tempo.
        </p>

        <section className="mb-6 space-y-2">
          <h3 className="font-display text-xs font-bold uppercase tracking-[0.18em] text-accent">Fontes de controle</h3>
          <div className="flex flex-col items-start gap-2">
            <Toggle checked={pedal.screenButtons} onChange={(v) => onChange({ screenButtons: v })} label="Botões na tela (toque ou mouse)" />
            <Toggle checked={pedal.tapZones} onChange={(v) => onChange({ tapZones: v })} label="Toque nas laterais da tela / deslizar" />
            <Toggle checked={pedal.midi.enabled} onChange={(v) => onChange({ midi: { ...pedal.midi, enabled: v } })} label="Pedal MIDI" title="Pedais MIDI (Chrome/Edge)" />
          </div>
          {pedal.midi.enabled && midiStatus && <p className="text-xs text-muted">{midiStatus}</p>}
          <p className="text-xs text-muted">Teclado e pedais USB/Bluetooth que mandam teclas funcionam sempre — configure abaixo.</p>
        </section>

        <section className="mb-6">
          <h3 className="mb-2 font-display text-xs font-bold uppercase tracking-[0.18em] text-accent">Botões do pedal</h3>
          <div className="space-y-2">
            {(['left', 'middle', 'right'] as Side[]).map((s) => (
              <div key={s} className="flex items-center gap-2 rounded-2xl border border-line p-2.5">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold">{SIDE_NAMES[s]}</div>
                  <div className="truncate text-xs text-muted">
                    Tecla: <b className="text-ink">{keyLabel(pedal.keys[s])}</b>
                    {pedal.midi.enabled && <> · MIDI: <b className="text-ink">{midiLabel(pedal.midi[s])}</b></>}
                  </div>
                </div>
                <Btn variant={learning === s ? 'active' : 'ghost'} onClick={() => onLearn(s)} className="min-h-9 px-3 py-1.5">
                  {learning === s ? 'Aperte o botão…' : 'Gravar'}
                </Btn>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">
            Toque em “Gravar” e aperte o botão do pedal (ou uma tecla). {learning && 'Esc cancela.'}
          </p>
          <Btn className="mt-2 min-h-9" onClick={() => onChange({ keys: DEFAULT_PEDAL.keys, midi: { enabled: pedal.midi.enabled } })}>
            Restaurar padrão (← ↓ →)
          </Btn>
        </section>

        <section className="mb-6 space-y-3">
          <h3 className="font-display text-xs font-bold uppercase tracking-[0.18em] text-accent">Ajustes</h3>
          <label className="flex items-center justify-between gap-3 text-sm font-semibold">
            Voltar ao modo 1 após parado
            <span className="inline-flex items-center gap-2">
              <input
                type="number"
                min={5}
                max={300}
                value={pedal.idleSeconds}
                onChange={(e) => onChange({ idleSeconds: Math.min(300, Math.max(5, Number(e.target.value) || 30)) })}
                className="h-9 w-20 rounded-full border border-line bg-card px-3 text-center text-ink outline-none focus:border-accent"
              />
              s
            </span>
          </label>
          <Seg
            value={viewMode}
            onChange={onViewMode}
            options={[
              { value: 'full', label: 'Letra e cifra' },
              { value: 'compact', label: 'Só acordes' },
            ]}
          />
        </section>

        <section>
          <h3 className="mb-2 font-display text-xs font-bold uppercase tracking-[0.18em] text-accent">Como funciona</h3>
          <ul className="space-y-1.5 text-sm text-muted">
            <li><b className="text-ink">Meio:</b> toque troca de modo (1→2→3→4→5). Segurar volta ao modo 1.</li>
            <li><b className="text-ink">1 · Cifra:</b> direito passa a cifra para o lado, esquerdo volta.</li>
            <li><b className="text-ink">2 · Tonalidade:</b> direito sobe ½ tom, esquerdo desce.</li>
            <li><b className="text-ink">3 · Simplificar:</b> direito liga, esquerdo desliga.</li>
            <li><b className="text-ink">4 · Tamanho da fonte:</b> direito aumenta, esquerdo diminui.</li>
            <li><b className="text-ink">5 · Músicas:</b> abre a lista; esquerdo/direito escolhem, segurar o direito (o que passa a cifra) abre a música (ou toque nela).</li>
            <li>Parado fora do modo 1, o próximo toque lateral volta ao modo 1 e já passa a cifra.</li>
          </ul>
        </section>
      </aside>
    </div>
  );
}

/** Lista rápida de músicas (modo 5): o pedal move o destaque; tocar numa música abre direto. */
function SongPicker({
  songs, index, currentId, onHover, onChoose,
}: {
  songs: Song[];
  index: number;
  currentId: string;
  onHover: (i: number) => void;
  onChoose: (id: string) => void;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => {
    refs.current[index]?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [index]);
  return (
    <div className="absolute inset-0 z-20 overflow-y-auto bg-surface/95 px-4 py-4 backdrop-blur-sm">
      <div className="mx-auto max-w-xl">
        <h2 className="mb-1 font-display text-xl font-extrabold">Trocar de música</h2>
        <p className="mb-3 text-sm text-muted">Esquerdo/direito escolhem · segure o direito para abrir · ou toque na música.</p>
        <ul className="space-y-2 pb-16">
          {songs.map((sg, i) => (
            <li key={sg.id}>
              <button
                ref={(el) => { refs.current[i] = el; }}
                onClick={() => onChoose(sg.id)}
                onPointerEnter={(e) => e.pointerType === 'mouse' && onHover(i)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition',
                  i === index ? 'border-accent bg-accent/15 shadow-soft' : 'border-line bg-card',
                )}
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-chord/15 font-display text-lg font-extrabold text-chord">{sg.currentKey}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-base font-bold">{sg.title}</span>
                  <span className="block truncate text-xs text-muted">{sg.artist || 'Sem artista'}{sg.id === currentId && ' · tocando agora'}</span>
                </span>
                {i === index && <ChevronRight size={20} className="shrink-0 text-accent" />}
              </button>
            </li>
          ))}
          {!songs.length && <li className="text-muted">Nenhuma música na biblioteca.</li>}
        </ul>
      </div>
    </div>
  );
}
