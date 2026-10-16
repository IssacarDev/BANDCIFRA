import assert from 'node:assert/strict';
import {
  buildContext, resolveChord, semitoneDiff, simplifyChord, transposeChord, transposeKey,
} from '../lib/chords';
import { chordKind } from '../lib/chords';
import { getChordShape } from '../lib/chordShapes';
import { isChordLine, linesToText, parseCifraText, parseLines } from '../lib/parser';
import { itemsToText } from '../lib/pdfParser';
import { DEMO_SONG } from '../lib/demo';
import { duplicateDraft, mergeDraft, moveDraft, toDrafts } from '../lib/blocks';
import { handlePedal, initialPedal, midiPress, type PedalState } from '../lib/presenter';
import { createTapTempo } from '../hooks/useMetronome';

// transposição
assert.equal(transposeChord('C7M(9)', 2), 'D7M(9)');
assert.equal(transposeChord('F#m7', 1), 'Gm7');
assert.equal(transposeChord('Bb', 2, true), 'C');
assert.equal(transposeChord('G/B', 2), 'A/C#');
assert.equal(transposeChord('Bm7(b5)', -1, false), 'A#m7(b5)');
assert.equal(transposeChord('Bm7(b5)', -1, true), 'Bbm7(b5)');
assert.equal(transposeKey('G', 2), 'A');
assert.equal(transposeKey('Em', -2), 'Dm');
assert.equal(semitoneDiff('G', 'A'), 2);
assert.equal(semitoneDiff('G', 'F'), -2);

// simplificação
assert.equal(simplifyChord('C7M(9)'), 'C');
assert.equal(simplifyChord('F#m7'), 'F#m');
assert.equal(simplifyChord('Bm7(b5)'), 'Bm');
assert.equal(simplifyChord('G/B'), 'G');
assert.equal(simplifyChord('G/B', { keepBass: true }), 'G/B');
assert.equal(simplifyChord('Dsus4'), 'D');
assert.equal(simplifyChord('Cmaj7'), 'C');
assert.equal(simplifyChord('Cº'), 'Cdim');
assert.equal(simplifyChord('A7'), 'A7');
assert.equal(simplifyChord('A7(b9)'), 'A7');
assert.equal(simplifyChord('A9'), 'A7');
assert.equal(simplifyChord('D7(4)'), 'D7');
assert.equal(simplifyChord('G7M'), 'G');
assert.equal(simplifyChord('E7/G#'), 'E7');
assert.equal(simplifyChord('D4'), 'D');

// capo: som real A, capo 2 => formato G
const ctx = buildContext({ originalKey: 'G', currentKey: 'A', capo: 2 }, { simplified: false, showSounding: false });
assert.equal(ctx.steps, 2);
assert.deepEqual(resolveChord('G', ctx), { label: 'G', shape: 'G' }); // G +2 = A (som) -2 = G (formato)
assert.equal(resolveChord('Em7', { ...ctx, showSounding: true }).label, 'F#m7');

// detecção de linhas
assert.ok(isChordLine('G   D/F#   Em7  C7M(9)'));
assert.ok(isChordLine('C | G | Am | F (2x)'));
assert.ok(!isChordLine('Quando a manhã chega devagar'));
assert.ok(!isChordLine('Eu amo Deus'));

// parser da demo
const names = DEMO_SONG.blocks.map((b) => b.label);
assert.deepEqual(names, ['Intro', 'Verso 1', 'Pré-Refrão', 'Refrão', 'Verso 2', 'Ponte', 'Final']);
assert.equal(DEMO_SONG.originalKey, 'G');
assert.equal(DEMO_SONG.blocks[1].lines[0].text, 'Quando a manhã chega devagar');
assert.equal(DEMO_SONG.blocks[1].lines[0].chords[1].charIndex, 17);

// ida e volta cifra <-> texto
const b = DEMO_SONG.blocks[3];
assert.deepEqual(parseLines(linesToText(b.lines).split('\n')).map((l) => l.text), b.lines.map((l) => l.text));

// cabeçalho estilo Cifra Club + capotraste
const cc = parseCifraText(
  `Tempo de Teste\nBanda Exemplo\nTom: A\nCapotraste na 2ª casa\nAfinação: E A D G B E\n\n[Intro]\nG D Em C\n\n[Refrão]\nG        D\nLetra do refrão\n`,
  { detectHeader: true },
);
assert.equal(cc.title, 'Tempo de Teste');
assert.equal(cc.artist, 'Banda Exemplo');
assert.equal(cc.capo, 2);
assert.equal(cc.tuning, 'E A D G B E');
assert.equal(cc.originalKey, 'A'); // formato G + capo 2 = som A
assert.equal(cc.blocks[0].lines[0].chords[0].chord, 'A');

// Holyrics: blocos por linha em branco, sem marcadores, repetição vira refrão
const hr = parseCifraText('Linha um\nLinha dois\n\nRefrão aqui\nmais refrão\n\nOutra estrofe\nfim\n\nRefrão aqui\nmais refrão\n');
assert.equal(hr.blocks.length, 4);
assert.equal(hr.blocks[1].type, 'chorus');
assert.equal(hr.blocks[3].type, 'chorus');

// PDF: reconstrução monoespaçada (itens sintéticos, 6pt por caractere)
const mk = (str: string, x: number, y: number) => ({ str, transform: [10, 0, 0, 10, x, y], width: str.length * 6 });
const txt = itemsToText([[
  mk('Titulo', 50, 800), mk('Artista', 50, 786),
  mk('G', 50, 740), mk('D', 110, 740), mk('Quando a manha', 50, 728), mk('chega', 134, 728),
]]);
const lines = txt.split('\n');
assert.equal(lines[0], 'Titulo');
assert.equal(lines[1], 'Artista');
const chordRow = lines.find((l) => l.startsWith('G'))!;
assert.equal(chordRow.indexOf('D'), 10);

// editor de blocos
let d = toDrafts(DEMO_SONG);
const n = d.length;
d = duplicateDraft(d, 3);
assert.equal(d.length, n + 1);
assert.equal(d[3].text, d[4].text);
assert.notEqual(d[3].id, d[4].id);
d = mergeDraft(d, 3, 1);
assert.equal(d.length, n);
d = moveDraft(d, 0, 2);
assert.equal(d[2].label, 'Intro');

// diagramas
assert.deepEqual(getChordShape('G'), [3, 2, 0, 0, 0, 3]);
assert.deepEqual(getChordShape('F'), [1, 3, 3, 2, 1, 1]);
assert.deepEqual(getChordShape('Bm'), [-1, 2, 4, 4, 3, 2]);
assert.ok(getChordShape('Bm7(b5)'));

// tap tempo
const tap = createTapTempo();
tap(0); tap(500); tap(1000);
assert.equal(tap(1500), 120);

assert.equal(chordKind('C'), 'maj'); assert.equal(chordKind('C7M(9)'), 'maj');
assert.equal(chordKind('Am7'), 'min'); assert.equal(chordKind('F#m'), 'min'); assert.equal(chordKind('Bm7(b5)'), 'min');
assert.equal(chordKind('A7'), 'dom'); assert.equal(chordKind('D9'), 'dom'); assert.equal(chordKind('E7(b9)'), 'dom');
assert.equal(chordKind('Dsus4'), 'other'); assert.equal(chordKind('Cº'), 'other'); assert.equal(chordKind('G/B'), 'maj');

// pedal / modo apresentação
{
  const IDLE = 30000;
  let st: PedalState = initialPedal(0);
  let r = handlePedal('right', 1000, st, IDLE); st = r.state;
  assert.deepEqual(r.action, { type: 'page', dir: 1 });
  r = handlePedal('left', 2000, st, IDLE); st = r.state;
  assert.deepEqual(r.action, { type: 'page', dir: -1 });
  // meio: 1 -> 2 -> 3 -> 4 -> 1 (toques espaçados)
  r = handlePedal('middle', 3000, st, IDLE); st = r.state; assert.equal(st.mode, 2);
  r = handlePedal('right', 4000, st, IDLE); st = r.state; assert.deepEqual(r.action, { type: 'transpose', dir: 1 });
  r = handlePedal('middle', 5000, st, IDLE); st = r.state; assert.equal(st.mode, 3);
  r = handlePedal('right', 6000, st, IDLE); st = r.state; assert.deepEqual(r.action, { type: 'simplify', value: true });
  r = handlePedal('left', 7000, st, IDLE); st = r.state; assert.deepEqual(r.action, { type: 'simplify', value: false });
  r = handlePedal('middle', 8000, st, IDLE); st = r.state; assert.equal(st.mode, 4);
  r = handlePedal('left', 9000, st, IDLE); st = r.state; assert.deepEqual(r.action, { type: 'font', dir: -1 });
  r = handlePedal('middle', 10000, st, IDLE); st = r.state; assert.equal(st.mode, 5);
  r = handlePedal('right', 10500, st, IDLE); st = r.state; assert.deepEqual(r.action, { type: 'pick', dir: 1 });
  r = handlePedal('left', 10800, st, IDLE); st = r.state; assert.deepEqual(r.action, { type: 'pick', dir: -1 });
  r = handlePedal('rightHold', 11500, st, IDLE); st = r.state; assert.equal(st.mode, 1); assert.deepEqual(r.action, { type: 'pickConfirm' });
  // segurar o meio volta ao modo 1
  r = handlePedal('middle', 11000, st, IDLE); st = r.state; assert.equal(st.mode, 2);
  r = handlePedal('middleHold', 11800, st, IDLE); st = r.state; assert.equal(st.mode, 1);
  // ocioso > 30 s fora do modo 1: toque lateral volta ao 1 e passa a cifra
  r = handlePedal('middle', 20000, st, IDLE); st = r.state; assert.equal(st.mode, 2);
  r = handlePedal('right', 20000 + 31000, st, IDLE); st = r.state;
  assert.equal(st.mode, 1); assert.deepEqual(r.action, { type: 'page', dir: 1 });
  // sem ociosidade, continua no modo
  r = handlePedal('middle', 60000, st, IDLE); st = r.state; assert.equal(st.mode, 2);
  r = handlePedal('right', 70000, st, IDLE); st = r.state; assert.equal(st.mode, 2);
  // duplo toque rápido no meio volta ao modo 1
  r = handlePedal('middle', 80000, st, IDLE); st = r.state; assert.equal(st.mode, 3);
  r = handlePedal('middle', 80200, st, IDLE); st = r.state; assert.equal(st.mode, 1);
  // MIDI
  assert.equal(midiPress([0x90, 60, 100]), 'note:0:60');
  assert.equal(midiPress([0x90, 60, 0]), null);
  assert.equal(midiPress([0xb1, 64, 127]), 'cc:1:64');
  assert.equal(midiPress([0xc0, 5]), 'pc:0:5');
}
console.log('selftest OK');
