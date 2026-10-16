'use client';
import { useEffect } from 'react';
import { Printer, X } from 'lucide-react';
import { useStore } from '@/lib/store';
import { Btn, Seg, Toggle } from './ui';
import { cn } from '@/lib/utils';
import type { ThemeName } from '@/types/song';

const THEMES: { id: ThemeName; name: string; bg: string; fg: string; chord: string }[] = [
  { id: 'light', name: 'Claro', bg: '#f7f6fc', fg: '#1b1830', chord: '#d6480c' },
  { id: 'dark', name: 'Escuro', bg: '#0e0d16', fg: '#eeebf7', chord: '#ffc457' },
  { id: 'oled', name: 'Preto OLED', bg: '#000', fg: '#fff', chord: '#ffd666' },
];

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-line px-5 py-4">
      <h3 className="mb-0.5 font-display text-base font-bold">{title}</h3>
      {hint && <p className="mb-3 text-xs leading-snug text-muted">{hint}</p>}
      {!hint && <div className="mb-2" />}
      {children}
    </section>
  );
}

function Slider({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <label className="mb-3 block last:mb-0">
      <span className="mb-1 flex justify-between text-sm">
        {label}
        <span className="tabular-nums text-muted">{value}px</span>
      </span>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-accent" />
    </label>
  );
}

/** Painel lateral com ajustes de aparência e opções menos usadas. */
export default function SettingsDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const prefs = useStore((s) => s.prefs);
  const setPrefs = useStore((s) => s.setPrefs);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="no-print fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-sm flex-col overflow-y-auto bg-surface shadow-lift">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-display text-xl font-bold">Ajustes</h2>
          <button onClick={onClose} aria-label="Fechar" className="rounded-lg p-2 hover:bg-line/50"><X size={20} /></button>
        </div>

        <Section title="Tema">
          <div className="grid grid-cols-3 gap-2">
            {THEMES.map((t) => (
              <button
                key={t.id}
                onClick={() => setPrefs({ theme: t.id })}
                className={cn('rounded-2xl border-2 p-2 text-left transition', prefs.theme === t.id ? 'border-accent' : 'border-line hover:border-muted')}
              >
                <div className="mb-1.5 rounded-md p-2 font-mono text-xs leading-tight" style={{ background: t.bg, color: t.fg }}>
                  <div style={{ color: t.chord }} className="font-bold">G&nbsp;&nbsp;Em</div>
                  <div>Letra</div>
                </div>
                <div className="text-xs font-medium">{t.name}</div>
              </button>
            ))}
          </div>
        </Section>

        <Section title="Cores dos acordes" hint="Cada tipo de acorde tem sua cor, para você reconhecer a harmonia de relance.">
          <Toggle checked={prefs.colorChords} onChange={(v) => setPrefs({ colorChords: v })} label="Colorir por tipo" />
          <ul className="mt-3 grid grid-cols-2 gap-2 text-sm">
            {([
              ['maj', 'Maior', 'C  G7M'],
              ['min', 'Menor', 'Am  F#m7'],
              ['dom', 'Com sétima', 'A7  D9'],
              ['other', 'Outros', 'Dsus4  Bdim'],
            ] as const).map(([k, name, ex]) => (
              <li key={k} className="flex items-center gap-2">
                <span className="chord-chip shrink-0 font-mono text-xs font-bold" data-kind={k}>{ex.split('  ')[0]}</span>
                <span className="leading-tight"><span className="font-semibold">{name}</span><br /><span className="text-xs text-muted">{ex.replace('  ', ', ')}</span></span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Tamanho do texto" hint="Em duas colunas o app reduz sozinho se não couber na tela.">
          <Slider label="Letra" value={prefs.fontSize} min={10} max={44} onChange={(v) => setPrefs({ fontSize: v })} />
          <Slider label="Acordes" value={prefs.chordSize} min={10} max={44} onChange={(v) => setPrefs({ chordSize: v })} />
        </Section>

        <Section title="Como mostrar os acordes" hint="Com capotraste, o “formato tocado” é a posição dos dedos; o “som real” é o tom que o público escuta.">
          <Seg
            value={prefs.showSounding ? 'sound' : 'shape'}
            onChange={(v) => setPrefs({ showSounding: v === 'sound' })}
            options={[
              { value: 'shape', label: 'Formato tocado' },
              { value: 'sound', label: 'Som real' },
            ]}
          />
        </Section>

        <Section title="Imprimir / exportar PDF" hint="Gera uma versão limpa (fundo branco, sem botões) com o tom, capo e modo atuais.">
          <Btn onClick={() => { onClose(); setTimeout(() => window.print(), 150); }}><Printer size={16} /> Imprimir ou salvar em PDF</Btn>
        </Section>

        <Section title="Atalhos do teclado">
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
            {[
              ['Espaço', 'Iniciar / pausar a rolagem'],
              ['↑  ↓', 'Mudar a velocidade da rolagem'],
              ['←  →', 'Música anterior / próxima (repertório)'],
              ['Esc', 'Fechar este painel'],
            ].map(([k, v]) => (
              <div key={k} className="contents">
                <dt><kbd className="rounded-md border border-line bg-card px-1.5 py-0.5 text-xs">{k}</kbd></dt>
                <dd className="text-muted">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-muted">No celular/tablet, deslize para os lados para trocar de música no repertório. Toque num acorde para ver o diagrama.</p>
        </Section>
      </aside>
    </div>
  );
}
