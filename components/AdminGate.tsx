'use client';
import Link from 'next/link';
import { Lock } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useHydrated } from '@/hooks/useHydrated';
import { LoginForm } from './LoginDialog';

/** Só deixa passar o admin; os demais veem o login. */
export default function AdminGate({ children }: { children: React.ReactNode }) {
  const hydrated = useHydrated();
  const isAdmin = useAuth((s) => s.isAdmin);
  if (!hydrated) return <div className="p-6 text-muted" suppressHydrationWarning>Carregando…</div>;
  if (isAdmin) return <>{children}</>;
  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5">
      <div className="rounded-3xl border border-line bg-card p-6 shadow-lift">
        <span className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-accent/15 text-accent"><Lock size={20} /></span>
        <h1 className="font-display text-2xl font-extrabold">Área do administrador</h1>
        <p className="mb-4 mt-1 text-sm text-muted">Para importar, criar ou editar cifras é preciso entrar como admin.</p>
        <LoginForm />
      </div>
      <Link href="/" className="mt-4 text-center text-sm font-semibold text-accent underline">Voltar às cifras</Link>
    </div>
  );
}
