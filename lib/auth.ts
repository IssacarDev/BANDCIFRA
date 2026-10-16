import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * Acesso simples: o app roda inteiro no navegador (sem servidor), então este login
 * separa o que o usuário comum vê do que o admin pode mexer. Não é segurança forte.
 */
const ADMIN_USER = 'admin';
const ADMIN_PASS = 'admin';

interface AuthState {
  isAdmin: boolean;
  login: (user: string, pass: string) => boolean;
  logout: () => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      isAdmin: false,
      login: (user, pass) => {
        const ok = user.trim().toLowerCase() === ADMIN_USER && pass === ADMIN_PASS;
        if (ok) set({ isAdmin: true });
        return ok;
      },
      logout: () => set({ isAdmin: false }),
    }),
    { name: 'cifra-app:auth', version: 1, storage: createJSONStorage(() => localStorage) },
  ),
);
