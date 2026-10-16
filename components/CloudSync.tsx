'use client';

import { useEffect } from 'react';
import { useHydrated } from '@/hooks/useHydrated';
import { useStore } from '@/lib/store';
import type { Setlist, Song } from '@/types/song';

type LibraryResponse = { songs: unknown; setlists: unknown };

function isLibrary(value: unknown): value is { songs: Song[]; setlists: Setlist[] } {
  return typeof value === 'object' && value !== null
    && Array.isArray((value as LibraryResponse).songs)
    && Array.isArray((value as LibraryResponse).setlists);
}

/** Mantém músicas e repertórios sincronizados com o Neon; preferências continuam por aparelho. */
export default function CloudSync() {
  const hydrated = useHydrated();

  useEffect(() => {
    if (!hydrated) return;
    let active = true;
    let ready = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const save = async () => {
      const { songs, setlists } = useStore.getState();
      try {
        await fetch('/api/library', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ songs, setlists }),
          keepalive: true,
        });
      } catch {
        // Sem rede: o Zustand mantém a alteração local e uma próxima edição tenta salvar de novo.
      }
    };

    const unsubscribe = useStore.subscribe((next, previous) => {
      if (!ready || (next.songs === previous.songs && next.setlists === previous.setlists)) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void save(), 500);
    });

    void fetch('/api/library', { cache: 'no-store' })
      .then(async (response) => (response.ok ? response.json() : null))
      .then((data: unknown) => {
        if (!active || !isLibrary(data)) return;
        useStore.getState().replaceLibrary(data.songs, data.setlists);
        ready = true;
      })
      .catch(() => {
        // Desenvolvimento sem DATABASE_URL continua funcionando em modo local.
      });

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, [hydrated]);

  return null;
}
