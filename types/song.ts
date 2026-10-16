export type SectionType =
  | 'intro'
  | 'verse'
  | 'pre-chorus'
  | 'chorus'
  | 'bridge'
  | 'solo'
  | 'outro';

export interface ChordPosition {
  chord: string;
  /** Índice do caractere da letra sob o qual o acorde é tocado. */
  charIndex: number;
}

export interface LyricLine {
  text: string;
  chords: ChordPosition[];
}

export interface SongBlock {
  id: string;
  type: SectionType;
  label: string;
  lines: LyricLine[];
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  /** Tom em que os acordes estão gravados em `blocks`. */
  originalKey: string;
  /** Tom atual (soando) após transposição. */
  currentKey: string;
  /** Casa do capotraste (0 = sem capo). */
  capo: number;
  bpm?: number;
  timeSignature?: string;
  blocks: SongBlock[];
  // ---- extras (opcionais) ----
  tuning?: string;
  /** Se for uma "Minha Versão", id da música de origem. */
  variantOf?: string;
  updatedAt?: number;
  /** Quebras de página manuais da apresentação (chaves `blocoId:linha`). Vazio/ausente = automático. */
  pageBreaks?: string[];
}

export interface Setlist {
  id: string;
  name: string;
  songIds: string[];
}

export type ThemeName = 'light' | 'dark' | 'oled';
export type ViewMode = 'full' | 'compact';

/** Configuração dos controles do modo apresentação (pedal de 3 botões). */
export interface PedalConfig {
  /** KeyboardEvent.code de cada botão (pedais USB/Bluetooth costumam mandar teclas). */
  keys: { left: string; middle: string; right: string };
  /** Pedal MIDI (Web MIDI). Assinatura: `tipo:canal:dado1`. */
  midi: { enabled: boolean; left?: string; middle?: string; right?: string };
  /** Mostra os 3 botões na tela (toque/mouse). */
  screenButtons: boolean;
  /** Toque nas laterais da tela = voltar / avançar. */
  tapZones: boolean;
  /** Segundos parado fora do modo 1 até o próximo toque lateral voltar ao modo 1. */
  idleSeconds: number;
}

export interface Prefs {
  theme: ThemeName;
  /** px da letra */
  fontSize: number;
  /** px dos acordes */
  chordSize: number;
  columns: 1 | 2;
  viewMode: ViewMode;
  simplified: boolean;
  /** false = mostra o formato tocado (com capo); true = som real */
  showSounding: boolean;
  /** colore cada acorde pelo tipo (maior, menor, com sétima, outros) */
  colorChords: boolean;
  pedal: PedalConfig;
}
