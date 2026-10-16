import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { PedalConfig, Prefs, Setlist, Song } from '@/types/song';
import { DEMO_SONG } from './demo';
import { uid } from './utils';
import type { Backup } from './backup';

export const DEFAULT_PEDAL: PedalConfig = {
  keys: { left: 'ArrowLeft', middle: 'ArrowDown', right: 'ArrowRight' },
  midi: { enabled: false },
  screenButtons: true,
  tapZones: true,
  idleSeconds: 30,
};

export const DEFAULT_PREFS: Prefs = {
  theme: 'dark',
  fontSize: 20,
  chordSize: 18,
  columns: 1,
  viewMode: 'full',
  simplified: false,
  showSounding: false,
  colorChords: true,
  pedal: DEFAULT_PEDAL,
};

interface State {
  songs: Song[];
  setlists: Setlist[];
  prefs: Prefs;

  addSong: (song: Song) => void;
  updateSong: (id: string, patch: Partial<Song>) => void;
  removeSong: (id: string) => void;
  /** Cópia independente (ex.: "Minha Versão" com arranjo alternativo). */
  saveAsVersion: (id: string, patch?: Partial<Song>) => string | null;
  setPrefs: (patch: Partial<Prefs>) => void;

  addSetlist: (name: string) => string;
  renameSetlist: (id: string, name: string) => void;
  removeSetlist: (id: string) => void;
  setSetlistSongs: (id: string, songIds: string[]) => void;

  importBackup: (b: Backup, mode: 'merge' | 'replace') => void;
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      songs: [DEMO_SONG],
      setlists: [],
      prefs: DEFAULT_PREFS,

      addSong: (song) => set((s) => ({ songs: [song, ...s.songs] })),
      updateSong: (id, patch) =>
        set((s) => ({
          songs: s.songs.map((x) => (x.id === id ? { ...x, ...patch, updatedAt: Date.now() } : x)),
        })),
      removeSong: (id) =>
        set((s) => ({
          songs: s.songs.filter((x) => x.id !== id),
          setlists: s.setlists.map((l) => ({ ...l, songIds: l.songIds.filter((i) => i !== id) })),
        })),
      saveAsVersion: (id, patch = {}) => {
        const src = get().songs.find((x) => x.id === id);
        if (!src) return null;
        const copy: Song = {
          ...JSON.parse(JSON.stringify(src)),
          id: uid(),
          variantOf: src.variantOf ?? src.id,
          updatedAt: Date.now(),
          ...patch,
        };
        const idMap: Record<string, string> = {};
        copy.blocks = (patch.blocks ?? copy.blocks).map((b) => {
          const nid = uid();
          idMap[b.id] = nid;
          return { ...b, id: nid };
        });
        if (copy.pageBreaks) {
          copy.pageBreaks = copy.pageBreaks
            .map((k) => {
              const [bid, rest] = [k.slice(0, k.lastIndexOf(':')), k.slice(k.lastIndexOf(':') + 1)];
              return idMap[bid] ? `${idMap[bid]}:${rest}` : '';
            })
            .filter(Boolean);
        }
        set((s) => ({ songs: [copy, ...s.songs] }));
        return copy.id;
      },
      setPrefs: (patch) => set((s) => ({ prefs: { ...s.prefs, ...patch } })),

      addSetlist: (name) => {
        const id = uid();
        set((s) => ({ setlists: [...s.setlists, { id, name, songIds: [] }] }));
        return id;
      },
      renameSetlist: (id, name) =>
        set((s) => ({ setlists: s.setlists.map((l) => (l.id === id ? { ...l, name } : l)) })),
      removeSetlist: (id) => set((s) => ({ setlists: s.setlists.filter((l) => l.id !== id) })),
      setSetlistSongs: (id, songIds) =>
        set((s) => ({ setlists: s.setlists.map((l) => (l.id === id ? { ...l, songIds } : l)) })),

      importBackup: (b, mode) =>
        set((s) => {
          if (mode === 'replace') return { songs: b.songs, setlists: b.setlists };
          const songs = [...s.songs];
          for (const song of b.songs) {
            const i = songs.findIndex((x) => x.id === song.id);
            if (i >= 0) songs[i] = song;
            else songs.push(song);
          }
          const setlists = [...s.setlists];
          for (const l of b.setlists) {
            const i = setlists.findIndex((x) => x.id === l.id);
            if (i >= 0) setlists[i] = l;
            else setlists.push(l);
          }
          return { songs, setlists };
        }),
    }),
    {
      name: 'cifra-app:v1',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<State>;
        const pp = (p.prefs ?? {}) as Partial<Prefs>;
        const pedal: PedalConfig = {
          ...DEFAULT_PEDAL,
          ...(pp.pedal ?? {}),
          keys: { ...DEFAULT_PEDAL.keys, ...(pp.pedal?.keys ?? {}) },
          midi: { ...DEFAULT_PEDAL.midi, ...(pp.pedal?.midi ?? {}) },
        };
        return { ...current, ...p, prefs: { ...current.prefs, ...pp, pedal } };
      },
    },
  ),
);
