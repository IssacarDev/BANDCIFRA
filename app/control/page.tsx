'use client';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Controller from '@/components/Controller';
import { Btn } from '@/components/ui';

function Inner() {
  const param = (useSearchParams().get('c') ?? '').toUpperCase();
  const [typed, setTyped] = useState('');
  const [code, setCode] = useState(/^[A-Z0-9]{4,12}$/.test(param) ? param : '');

  if (code) return <Controller code={code} />;
  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5">
      <div className="rounded-3xl border border-line bg-card p-6 shadow-lift">
        <h1 className="font-display text-2xl font-extrabold">Controle remoto</h1>
        <p className="mb-4 mt-1 text-sm text-muted">Escaneie o QR Code da apresentação ou digite o código que aparece nele.</p>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const c = typed.trim().toUpperCase();
            if (/^[A-Z0-9]{4,12}$/.test(c)) setCode(c);
          }}
        >
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="Código (ex.: K7M2QX)"
            autoCapitalize="characters"
            className="min-h-12 w-full rounded-full border border-line bg-surface px-5 text-center font-display text-lg font-bold tracking-widest text-ink outline-none focus:border-accent"
          />
          <Btn variant="solid" type="submit" className="w-full">Conectar</Btn>
        </form>
      </div>
    </div>
  );
}

export default function ControlPage() {
  return (
    <Suspense fallback={<div className="p-6 text-muted" suppressHydrationWarning>Carregando…</div>}>
      <Inner />
    </Suspense>
  );
}
