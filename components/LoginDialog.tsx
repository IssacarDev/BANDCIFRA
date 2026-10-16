'use client';
import { useState } from 'react';
import { Lock, X } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { Btn } from './ui';

/** Formulário de login do administrador. */
export function LoginForm({ onDone }: { onDone?: () => void }) {
  const login = useAuth((s) => s.login);
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState(false);

  const field =
    'min-h-11 w-full rounded-full border border-line bg-card px-5 text-sm text-ink outline-none transition placeholder:text-muted focus:border-accent';

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (login(user, pass)) onDone?.();
        else setErr(true);
      }}
    >
      <input
        value={user}
        onChange={(e) => { setUser(e.target.value); setErr(false); }}
        placeholder="Usuário"
        autoComplete="username"
        autoCapitalize="none"
        autoFocus
        className={field}
      />
      <input
        value={pass}
        onChange={(e) => { setPass(e.target.value); setErr(false); }}
        type="password"
        placeholder="Senha"
        autoComplete="current-password"
        className={field}
      />
      {err && <p className="px-2 text-sm text-red-500">Usuário ou senha incorretos.</p>}
      <Btn variant="solid" type="submit" className="w-full">Entrar</Btn>
    </form>
  );
}

/** Janela de login (abre sobre a tela atual). */
export function LoginDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-3xl border border-line bg-card p-6 shadow-lift" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-accent/15 text-accent"><Lock size={18} /></span>
          <h2 className="flex-1 font-display text-xl font-extrabold">Entrar como admin</h2>
          <button onClick={onClose} aria-label="Fechar" className="grid h-9 w-9 place-items-center rounded-full border border-line hover:bg-accent/10"><X size={16} /></button>
        </div>
        <LoginForm onDone={onClose} />
      </div>
    </div>
  );
}
