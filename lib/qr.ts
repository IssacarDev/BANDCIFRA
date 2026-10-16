// Gerador de QR Code (biblioteca MIT embutida em ./qrcode-vendor.js, sem dependências externas)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const factory = require('./qrcode-vendor.js') as (
  type: number,
  ec: 'L' | 'M' | 'Q' | 'H',
) => { addData(s: string): void; make(): void; getModuleCount(): number; isDark(r: number, c: number): boolean };

/** Matriz de módulos do QR (true = escuro). */
export function qrMatrix(text: string): boolean[][] {
  const qr = factory(0, 'M');
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)));
}
