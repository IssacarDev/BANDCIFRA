import os from 'node:os';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Endereços da rede local deste computador (para o QR funcionar em outro celular). */
export async function GET() {
  const ips: string[] = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const i of list ?? []) {
      if (i.family === 'IPv4' && !i.internal) ips.push(i.address);
    }
  }
  // prefere redes domésticas comuns primeiro
  ips.sort((a, b) => Number(b.startsWith('192.168.')) - Number(a.startsWith('192.168.')));
  return Response.json({ ips });
}
