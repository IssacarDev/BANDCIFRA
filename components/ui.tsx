'use client';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'ghost' | 'solid' | 'active' | 'danger';

export function Btn({
  variant = 'ghost',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        'inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold transition active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40',
        variant === 'ghost' && 'border-line bg-card text-ink hover:border-accent/50 hover:bg-accent/10',
        variant === 'active' && 'border-accent bg-accent text-accentfg',
        variant === 'solid' && 'border-accent bg-accent text-accentfg shadow-soft hover:brightness-110',
        variant === 'danger' && 'border-line bg-card text-red-500 hover:border-red-500/50 hover:bg-red-500/10',
        className,
      )}
    />
  );
}

/** Seletor segmentado em pílula. */
export function Seg<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: ReactNode; title?: string }[];
  onChange: (v: T) => void;
  label?: string;
}) {
  return (
    <div className="inline-flex shrink-0 items-center gap-1 rounded-full border border-line bg-card p-1">
      {label && <span className="pl-3 pr-1 text-xs font-semibold text-muted">{label}</span>}
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          title={o.title}
          onClick={() => onChange(o.value)}
          className={cn(
            'inline-flex min-h-8 items-center gap-1.5 rounded-full px-3.5 py-1 text-sm font-semibold transition',
            o.value === value ? 'bg-accent text-accentfg' : 'text-muted hover:bg-accent/10 hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Interruptor liga/desliga com rótulo. */
export function Toggle({
  checked,
  onChange,
  label,
  title,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      title={title}
      onClick={() => onChange(!checked)}
      className="inline-flex min-h-10 shrink-0 items-center gap-2.5 rounded-full border border-line bg-card py-1 pl-3.5 pr-2 text-sm font-semibold text-ink hover:border-accent/50"
    >
      {label}
      <span className={cn('relative h-6 w-10 rounded-full transition', checked ? 'bg-accent' : 'bg-muted/35')}>
        <span className={cn('absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all', checked ? 'left-[22px]' : 'left-1')} />
      </span>
    </button>
  );
}

/** Controle com rótulo pequeno acima. */
export function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex shrink-0 flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</span>
      {children}
    </div>
  );
}
