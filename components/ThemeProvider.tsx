'use client';
import { useEffect } from 'react';
import { useStore } from '@/lib/store';

/** Aplica o tema (claro / escuro / OLED) em <html data-theme>. */
export default function ThemeProvider() {
  const theme = useStore((s) => s.prefs.theme);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  return null;
}
