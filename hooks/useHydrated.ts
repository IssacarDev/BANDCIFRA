'use client';
import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';

/** true quando o estado persistido (localStorage) já foi carregado — evita erro de hidratação. */
export function useHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const unsub = useStore.persist.onFinishHydration(() => setHydrated(true));
    if (useStore.persist.hasHydrated()) setHydrated(true);
    return unsub;
  }, []);
  return hydrated;
}
