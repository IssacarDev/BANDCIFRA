import type { Setlist, Song } from '@/types/song';
import { downloadText } from './utils';

export interface Backup {
  app: 'cifra-app';
  version: 1;
  exportedAt: string;
  songs: Song[];
  setlists: Setlist[];
}

export function makeBackup(songs: Song[], setlists: Setlist[]): Backup {
  return { app: 'cifra-app', version: 1, exportedAt: new Date().toISOString(), songs, setlists };
}

export function exportBackup(songs: Song[], setlists: Setlist[]) {
  const stamp = new Date().toISOString().slice(0, 10);
  downloadText(`cifras-backup-${stamp}.json`, JSON.stringify(makeBackup(songs, setlists), null, 2));
}

export function parseBackup(text: string): Backup {
  const data = JSON.parse(text);
  if (!data || data.app !== 'cifra-app' || !Array.isArray(data.songs)) {
    throw new Error('Arquivo não é um backup válido do app de cifras.');
  }
  return {
    app: 'cifra-app',
    version: 1,
    exportedAt: data.exportedAt ?? '',
    songs: data.songs as Song[],
    setlists: Array.isArray(data.setlists) ? (data.setlists as Setlist[]) : [],
  };
}
