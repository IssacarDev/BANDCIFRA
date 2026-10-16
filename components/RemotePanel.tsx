'use client';
import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, Smartphone, X } from 'lucide-react';
import { qrMatrix } from '@/lib/qr';
import { Btn } from './ui';

/** Janela com o QR Code que abre o controle remoto em outro celular. */
export default function RemotePanel({ code, controllers, onClose }: { code: string; controllers: number; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const url = origin ? `${origin}/control?c=${code}` : '';

  const matrix = useMemo(() => (url ? qrMatrix(url) : null), [url]);

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="max-h-full w-full max-w-sm overflow-y-auto rounded-3xl border border-line bg-card p-5 shadow-lift" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-accent/15 text-accent"><Smartphone size={18} /></span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-lg font-extrabold leading-tight">Controle pelo celular</h2>
            <p className="text-xs text-muted">{controllers > 0 ? `${controllers} controle(s) conectado(s)` : 'Aponte a câmera do outro celular para o QR'}</p>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="grid h-9 w-9 place-items-center rounded-full border border-line hover:bg-accent/10"><X size={16} /></button>
        </div>

        {matrix ? (
          <div className="mx-auto w-fit rounded-2xl bg-white p-3">
            <svg viewBox={`0 0 ${matrix.length + 2} ${matrix.length + 2}`} width={224} height={224} shapeRendering="crispEdges" role="img" aria-label="QR Code do controle remoto">
              <rect width="100%" height="100%" fill="#fff" />
              {matrix.map((row, r) =>
                row.map((on, c) => (on ? <rect key={`${r}-${c}`} x={c + 1} y={r + 1} width="1" height="1" fill="#111" /> : null)),
              )}
            </svg>
          </div>
        ) : (
          <div className="mx-auto grid h-56 w-56 place-items-center text-sm text-muted">Gerando…</div>
        )}

        <p className="mt-3 text-center font-display text-2xl font-extrabold tracking-[0.3em]">{code}</p>

        <div className="mt-3 break-all rounded-2xl bg-surface px-3 py-2 text-center text-xs text-muted">{url || '…'}</div>

        <Btn
          className="mt-3 w-full"
          onClick={() => {
            if (!url) return;
            void navigator.clipboard?.writeText(url).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
        >
          {copied ? <><Check size={16} /> Copiado</> : <><Copy size={16} /> Copiar link</>}
        </Btn>

        <p className="mt-3 text-xs text-muted">
          O controle funciona pela internet: abra este QR no celular, mesmo em outra rede. Mantenha a apresentação aberta no computador.
        </p>
      </div>
    </div>
  );
}
