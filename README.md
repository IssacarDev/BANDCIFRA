# Cifras — leitor e gerenciador de cifras (Next.js)

Next.js 16 (App Router) · TypeScript · Tailwind CSS 3 · Zustand · Neon Postgres · pdfjs-dist.
Músicas e repertórios são compartilhados pelo Neon; preferências visuais continuam salvas no navegador.

## Rodar

```bash
npm install
npm run dev          # http://localhost:3000
npm run test         # testes da lógica (transposição, parser, blocos...)
npm run build        # produção / Vercel
```

## Deploy na Vercel com Neon

1. Crie um projeto PostgreSQL no [Neon](https://neon.tech) e copie a connection string.
2. No projeto local, crie `.env.local` a partir de `.env.example` e cole o valor em `DATABASE_URL`.
3. Na Vercel, importe este repositório e adicione a mesma variável `DATABASE_URL` em **Settings → Environment Variables** para Production (e Preview, se desejar).
4. Faça o deploy. Na primeira chamada, o aplicativo cria as tabelas automaticamente e insere a cifra de demonstração.

Não exponha `DATABASE_URL` ao navegador nem a envie ao GitHub. Sem essa variável, o app continua útil em modo local, mas não sincroniza músicas, repertórios nem o controle remoto.

O projeto é intencionalmente aberto: `admin` / `admin` apenas libera a interface de edição e não é uma barreira de segurança. Qualquer pessoa com essa senha pode alterar o acervo compartilhado.

Antes do primeiro deploy, exporte um backup JSON de qualquer acervo que exista somente no navegador. O banco compartilhado passa a ser a fonte principal de músicas e repertórios assim que estiver configurado.

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
  store.ts, backup.ts   cache local, sincronização e exportação .json
  serverDb.ts           acesso server-side ao Neon e tabelas do app
types/song.ts           Song, SongBlock, LyricLine, ChordPosition...
scripts/selftest.ts     testes
```

## Convenções

- Os acordes em `Song.blocks` ficam no som real do tom `originalKey`. `currentKey` define a
  transposição e `capo` o capotraste; o formato tocado = som real − capo.
- Ao importar um PDF com "Capotraste na Nª casa", as cifras impressas são o *formato* tocado;
  o app soma o capo ao salvar (som real) e exibe de volta o mesmo formato do PDF.
- "Minha versão" = cópia independente (`variantOf` aponta para a original).
- O controle remoto usa polling curto sobre o Neon, portanto funciona em deploy serverless da Vercel; não depende da memória de uma única instância.

## Atalhos do leitor

Espaço = play/pause da rolagem · ↑/↓ = velocidade · ←/→ = música anterior/próxima (no repertório,
ou deslize no touch) · passe o mouse / toque num acorde para ver o diagrama.
