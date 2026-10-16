/**
 * Importador de PDF (client-side) — nenhum dado sai do navegador.
 *
 * 1. `pdfjs-dist` extrai os itens de texto vetorial com suas coordenadas.
 * 2. Reconstruímos as linhas agrupando por Y e posicionando cada trecho na
 *    coluna proporcional ao X (PDFs do Cifra Club são monoespaçados), o que
 *    preserva o alinhamento acorde-sobre-sílaba.
 * 3. O texto resultante passa por `parseCifraText` (detecção de acordes,
 *    cabeçalho Tom/Capo/Afinação e blocos).
 */
import type { Song } from '@/types/song';
import { parseCifraText } from './parser';

export interface PdfTextItem {
  str: string;
  /** [a, b, c, d, x, y] */
  transform: number[];
  width: number;
}

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

/** Converte os itens de texto de várias páginas em texto monoespaçado. */
export function itemsToText(pages: PdfTextItem[][]): string {
  const out: string[] = [];

  for (const raw of pages) {
    const items = raw.filter((it) => it.str.trim() !== '');
    if (!items.length) continue;

    const fontSizes = items.map((it) => Math.abs(it.transform[3]) || Math.abs(it.transform[0]) || 10);
    const tol = Math.max(1.5, median(fontSizes) * 0.35);

    // largura típica de um caractere (mediana de width/len)
    const widths = items.filter((it) => it.str.length >= 2 && it.width > 0).map((it) => it.width / it.str.length);
    const cw = median(widths) || median(fontSizes) * 0.6;
    const minX = Math.min(...items.map((it) => it.transform[4]));

    // agrupa por linha (Y decrescente)
    const sorted = [...items].sort((a, b) => b.transform[5] - a.transform[5] || a.transform[4] - b.transform[4]);
    const rows: { y: number; items: PdfTextItem[] }[] = [];
    for (const it of sorted) {
      const y = it.transform[5];
      const row = rows.find((r) => Math.abs(r.y - y) <= tol);
      if (row) row.items.push(it);
      else rows.push({ y, items: [it] });
    }
    rows.sort((a, b) => b.y - a.y);

    const gaps = rows.slice(1).map((r, i) => rows[i].y - r.y);
    const pitch = median(gaps) || median(fontSizes) * 1.2;

    rows.forEach((row, i) => {
      if (i > 0 && rows[i - 1].y - row.y > pitch * 1.6) out.push('');
      row.items.sort((a, b) => a.transform[4] - b.transform[4]);
      let line = '';
      for (const it of row.items) {
        const col = Math.round((it.transform[4] - minX) / cw);
        if (col > line.length) line = line.padEnd(col, ' ');
        else if (line && !line.endsWith(' ') && !it.str.startsWith(' ')) line += ' ';
        line += it.str;
      }
      out.push(line.replace(/\s+$/, ''));
    });
    out.push('');
  }
  return out.join('\n');
}

/** Lê um arquivo PDF no navegador e devolve o texto monoespaçado. */
export async function parsePdfToText(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();

  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  const pages: PdfTextItem[][] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    pages.push(
      content.items
        .filter((it): it is Extract<typeof it, { str: string }> => 'str' in it)
        .map((it) => ({ str: it.str, transform: it.transform as number[], width: it.width })),
    );
  }
  return itemsToText(pages);
}

/** Atalho: PDF -> Song. */
export async function parsePdfFile(file: File): Promise<Song> {
  const text = await parsePdfToText(file);
  return parseCifraText(text, {
    detectHeader: true,
    titleHint: file.name.replace(/\.pdf$/i, ''),
  });
}
