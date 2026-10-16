import { publish, validCode, type Role } from '@/lib/remoteHub';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const text = await req.text();
  if (text.length > 200_000) return new Response('too large', { status: 413 });
  let body: { code?: string; to?: Role; event?: string; data?: unknown };
  try {
    body = JSON.parse(text);
  } catch {
    return new Response('bad json', { status: 400 });
  }
  const code = (body.code ?? '').toUpperCase();
  const event = body.event === 'state' ? 'state' : 'cmd';
  const to = event === 'state' ? 'controller' : 'presenter';
  if (!validCode(code)) return new Response('bad code', { status: 400 });
  publish(code, to, event, body.data ?? null);
  return Response.json({ ok: true });
}
