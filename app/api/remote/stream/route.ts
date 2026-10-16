import { subscribe, validCode, type Role } from '@/lib/remoteHub';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = (url.searchParams.get('code') ?? '').toUpperCase();
  const role = url.searchParams.get('role') as Role;
  if (!validCode(code) || (role !== 'presenter' && role !== 'controller')) {
    return new Response('bad request', { status: 400 });
  }
  const enc = new TextEncoder();
  let unsub: (() => void) | undefined;
  let ping: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          /* conexão já fechada */
        }
      };
      const close = () => {
        if (ping) clearInterval(ping);
        unsub?.();
        unsub = undefined;
        try {
          controller.close();
        } catch {
          /* já fechado */
        }
      };
      send('hello', { ok: true });
      unsub = subscribe(code, role, send);
      ping = setInterval(() => send('ping', {}), 15000);
      req.signal.addEventListener('abort', close);
    },
    cancel() {
      if (ping) clearInterval(ping);
      unsub?.();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
