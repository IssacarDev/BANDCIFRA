'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ListMusic, LogOut, Minus, Plus, Wifi, WifiOff } from 'lucide-react';
import { useRemoteController } from '@/hooks/useRemote';
import { MODE_NAMES, actionLabels, type PresentMode } from '@/lib/presenter';
import type { RemoteCmd, Side } from '@/lib/remoteProto';
import { cn } from '@/lib/utils';

/** Tela do celular que controla a apresentação: os 3 botões do pedal + botões extras. */
export default function Controller({ code }: { code: string }) {
  const { state, presenters, online, send } = useRemoteController(code);
  const [more, setMore] = useState(false);
  const [list, setList] = useState(false);
  const [q, setQ] = useState('');
  const [down, setDown] = useState<Side | null>(null);

  // mantém a tela do controle acesa
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<typeof lock> } }).wakeLock
      ?.request('screen')
      .then((l) => (lock = l))
      .catch(() => {});
    return () => void lock?.release().catch(() => {});
  }, []);

  const buzz = () => navigator.vibrate?.(12);
  const cmd = (c: RemoteCmd) => {
    buzz();
    send(c);
  };
  const press = (side: Side, phase: 'down' | 'up') => {
    if (phase === 'down') {
      buzz();
      setDown(side);
    } else setDown(null);
    send({ k: 'press', side, phase });
  };
  const pedalProps = (side: Side) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      press(side, 'down');
    },
    onPointerUp: () => press(side, 'up'),
    onPointerCancel: () => press(side, 'up'),
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });

  const connected = online && presenters > 0;
  const mode = (state?.mode ?? 1) as PresentMode;
  const labels = actionLabels(mode);
  const nextMode = (mode === 5 ? 1 : mode + 1) as PresentMode;

  const big =
    'touch-none select-none rounded-3xl border font-display font-extrabold transition active:scale-[0.97] flex flex-col items-center justify-center gap-1';

  const songs = (state?.songs ?? []).filter((s) => `${s.title} ${s.artist}`.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div className="mx-auto flex min-h-dvh max-w-md select-none flex-col gap-3 px-4 pb-6 pt-4">
      {/* topo: estado */}
      <header className="rounded-3xl border border-line bg-card p-4">
        <div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
          {connected ? <Wifi size={14} className="text-green-500" /> : <WifiOff size={14} className="text-red-500" />}
          <span className={connected ? 'text-green-500' : 'text-red-500'}>
            {!online ? 'Sem conexão com o computador' : presenters > 0 ? 'Conectado à apresentação' : 'Aguardando a apresentação'}
          </span>
          <span className="ml-auto text-muted">{code}</span>
        </div>
        {state ? (
          <>
            <h1 className="truncate font-display text-xl font-extrabold leading-tight">{state.title}</h1>
            <p className="truncate text-sm text-muted">{state.artist || 'Sem artista'}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm font-bold">
              <span className="rounded-full bg-chord/15 px-3 py-1 text-chord">Tom {state.key}</span>
              {state.capo > 0 && <span className="rounded-full bg-accent/15 px-3 py-1 text-accent">Capo {state.capo}</span>}
              <span className="rounded-full bg-line/70 px-3 py-1 text-muted">Pág. {state.page + 1}/{state.pages}</span>
              {state.simplified && <span className="rounded-full bg-line/70 px-3 py-1 text-muted">Simplificada</span>}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted">Abra o modo apresentação no outro aparelho e toque no ícone do celular para ver o QR Code.</p>
        )}
      </header>

      {/* modo atual */}
      <div className="flex items-center justify-between rounded-full bg-accent px-5 py-2.5 text-accentfg shadow-soft">
        <span className="font-display text-sm font-extrabold uppercase tracking-widest">Modo {mode} · {MODE_NAMES[mode]}</span>
        <span className="text-xs font-semibold opacity-80">{labels.hint.split('·')[0].trim()}</span>
      </div>

      {/* os 3 botões do pedal */}
      <div className="grid flex-1 grid-cols-[1fr_1fr] grid-rows-[minmax(11rem,1fr)_auto] gap-3">
        <button {...pedalProps('left')} className={cn(big, 'border-line bg-card text-2xl', down === 'left' && 'bg-accent/20')}>
          <ChevronLeft size={40} />
          {labels.left}
        </button>
        <button {...pedalProps('right')} className={cn(big, 'border-accent bg-accent text-2xl text-accentfg shadow-soft', down === 'right' && 'brightness-125')}>
          <ChevronRight size={40} />
          {labels.right}
        </button>
        <button
          {...pedalProps('middle')}
          className={cn(big, 'col-span-2 min-h-24 border-accent/50 bg-accent/10 text-lg', down === 'middle' && 'bg-accent text-accentfg')}
        >
          <span className="text-xs font-bold uppercase tracking-widest text-accent">{down === 'middle' ? 'segurando…' : 'Botão do meio'}</span>
          <span>toque: {MODE_NAMES[nextMode]} · segure: Cifra</span>
        </button>
      </div>
      {mode === 5 && <p className="text-center text-xs text-muted">Na lista de músicas, <b className="text-ink">segure o botão direito</b> para abrir a música destacada.</p>}

      {/* outros botões */}
      <button
        onClick={() => setMore((v) => !v)}
        className="flex min-h-12 items-center justify-center gap-2 rounded-full border border-line bg-card text-sm font-bold"
      >
        Outros botões {more ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {more && (
        <section className="space-y-3 rounded-3xl border border-line bg-card p-4">
          <div>
            <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-muted">Ir para o modo</h2>
            <div className="grid grid-cols-5 gap-2">
              {([1, 2, 3, 4, 5] as PresentMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => cmd({ k: 'mode', mode: m })}
                  title={MODE_NAMES[m]}
                  className={cn('min-h-12 rounded-2xl border text-lg font-extrabold', m === mode ? 'border-accent bg-accent text-accentfg' : 'border-line bg-surface')}
                >
                  {m}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-center text-xs text-muted">{MODE_NAMES[mode]}</p>
          </div>

          <Row label={`Tom ${state?.key ?? ''}`}>
            <Pill onClick={() => cmd({ k: 'transpose', dir: -1 })}><Minus size={18} /> ½ tom</Pill>
            <Pill onClick={() => cmd({ k: 'transpose', dir: 1 })}><Plus size={18} /> ½ tom</Pill>
          </Row>

          <Row label={`Fonte ${state?.fontSize ?? ''}`}>
            <Pill onClick={() => cmd({ k: 'font', dir: -1 })}><Minus size={18} /> menor</Pill>
            <Pill onClick={() => cmd({ k: 'font', dir: 1 })}><Plus size={18} /> maior</Pill>
          </Row>

          <Row label="Simplificar">
            <Pill wide active={!!state?.simplified} onClick={() => cmd({ k: 'simplify' })}>
              {state?.simplified ? 'Simplificada · tocar para voltar' : 'Simplificar cifra'}
            </Pill>
          </Row>

          <Row label="Página">
            <Pill onClick={() => cmd({ k: 'page', dir: -1 })}><ChevronLeft size={18} /> voltar</Pill>
            <Pill onClick={() => cmd({ k: 'page', dir: 1 })}>avançar <ChevronRight size={18} /></Pill>
          </Row>

          <Row label="Música do repertório">
            <Pill disabled={!state?.hasPrev} onClick={() => cmd({ k: 'prevSong' })}><ChevronLeft size={18} /> anterior</Pill>
            <Pill disabled={!state?.hasNext} onClick={() => cmd({ k: 'nextSong' })}>próxima <ChevronRight size={18} /></Pill>
          </Row>

          <Pill wide onClick={() => setList((v) => !v)}><ListMusic size={18} /> {list ? 'Fechar lista de músicas' : 'Escolher outra música'}</Pill>
          {list && (
            <div className="space-y-2">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar música"
                className="min-h-11 w-full rounded-full border border-line bg-surface px-5 text-sm text-ink outline-none placeholder:text-muted focus:border-accent"
              />
              <ul className="max-h-72 space-y-1.5 overflow-y-auto">
                {songs.map((s) => (
                  <li key={s.id}>
                    <button
                      onClick={() => {
                        cmd({ k: 'song', id: s.id });
                        setList(false);
                      }}
                      className={cn('flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left', s.id === state?.songId ? 'border-accent bg-accent/15' : 'border-line bg-surface')}
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-chord/15 text-sm font-extrabold text-chord">{s.key}</span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold">{s.title}</span>
                        <span className="block truncate text-xs text-muted">{s.artist || 'Sem artista'}</span>
                      </span>
                    </button>
                  </li>
                ))}
                {!songs.length && <li className="px-2 py-3 text-sm text-muted">Nenhuma música encontrada.</li>}
              </ul>
            </div>
          )}

          <Pill wide danger onClick={() => window.confirm('Sair da apresentação no outro aparelho?') && cmd({ k: 'exit' })}>
            <LogOut size={18} /> Sair da apresentação
          </Pill>
        </section>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-muted">{label}</h2>
      <div className="flex gap-2">{children}</div>
    </div>
  );
}

function Pill({
  children, onClick, wide, active, danger, disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  wide?: boolean;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-2xl border px-3 text-sm font-bold transition active:scale-[0.97] disabled:opacity-40',
        wide && 'w-full',
        active ? 'border-accent bg-accent text-accentfg' : danger ? 'border-line bg-surface text-red-500' : 'border-line bg-surface',
      )}
    >
      {children}
    </button>
  );
}
