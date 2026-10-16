import type { Song } from '@/types/song';
import { parseCifraText } from './parser';

/** Letra original criada só para demonstração. */
const DEMO_TEXT = `[Intro]
G  D/F#  Em7  C7M(9)

[Verso 1]
G                D/F#
Quando a manhã chega devagar
Em7              C7M(9)
Eu me lembro de onde vim
G                D/F#
Cada passo que eu já dei
Em7          D4   D
Me trouxe até aqui

[Pré-Refrão]
Am7             Bm7(b5)
Mesmo sem saber o caminho
C7M(9)          D4   D
Eu sigo, eu sigo assim

[Refrão]
G           D/F#        Em7
Canta, canta, o dia vai nascer
C7M(9)      G/B         Am7   D4  D
Toda a estrada vai se abrir pra mim
G           D/F#        Em7
Canta, canta, não vou me esconder
C7M(9)      D4          G
Eu caminho, e a luz vai me guiar

[Verso 2]
G                D/F#
Se a noite vier de repente
Em7              C7M(9)
Eu descanso e volto a andar
G                D/F#
Quem confia não se perde
Em7          D4   D
Sabe pra onde ir

[Ponte]
Em7         D/F#
Um passo, mais um passo
G           C7M(9)
Sem pressa de chegar
Em7         D/F#
Um passo, mais um passo
Am7         D7  Dsus4  D
E o céu vai clarear

[Final]
C7M(9)  D4  G
`;

export const DEMO_SONG: Song = {
  ...parseCifraText(DEMO_TEXT, {
    id: 'demo',
    title: 'Caminho de Luz (Demonstração)',
    artist: 'Exemplo',
    originalKey: 'G',
    bpm: 76,
  }),
};
