# Cifras — leitor e gerenciador de cifras (Next.js)

Next.js 15 (App Router) · TypeScript · Tailwind CSS 3 · Zustand · pdfjs-dist.
Funciona 100% no navegador (dados em `localStorage`), pronto para `npm run dev` e deploy na Vercel.

## Rodar

```bash
npm install
npm run dev          # http://localhost:3000
npm run test         # testes da lógica (transposição, parser, blocos...)
npm run build        # produção / Vercel
```

Deploy: suba o projeto no GitHub e importe na Vercel (sem variáveis de ambiente).

## Estrutura

```
app/                    rotas (App Router)
  page.tsx              biblioteca + repertórios + backup
  import/               importador de PDF / texto
  song/[id]/            leitor           (?setlist=ID navega pelo repertório)
  song/[id]/edit/       editor de blocos
components/             Reader, SongView, Editor, ImportPanel, Library, painéis...
hooks/                  useAutoScroll, useMetronome (+tap tempo), useHydrated
lib/
  chords.ts             transposeChord, transposeKey, simplifyChord, capo, contexto de exibição
  chordShapes.ts        dicionário de acordes (digitação de violão)
  parser.ts             texto "cifra sobre letra" -> Song (acordes x letra, cabeçalho, blocos)
  pdfParser.ts          PDF -> texto monoespaçado (pdfjs-dist, client-side)
  blocks.ts             mover / duplicar / juntar blocos
  store.ts, backup.ts   estado persistido e exportação .json
types/song.ts           Song, SongBlock, LyricLine, ChordPosition...
scripts/selftest.ts     testes
```

## Convenções

- Os acordes em `Song.blocks` ficam no som real do tom `originalKey`. `currentKey` define a
  transposição e `capo` o capotraste; o formato tocado = som real − capo.
- Ao importar um PDF com "Capotraste na Nª casa", as cifras impressas são o *formato* tocado;
  o app soma o capo ao salvar (som real) e exibe de volta o mesmo formato do PDF.
- "Minha versão" = cópia independente (`variantOf` aponta para a original).

## Atalhos do leitor

Espaço = play/pause da rolagem · ↑/↓ = velocidade · ←/→ = música anterior/próxima (no repertório,
ou deslize no touch) · passe o mouse / toque num acorde para ver o diagrama.
