import { addRemoteCommand, databaseConfigured, logDatabaseError, publishRemoteState } from '@/lib/serverDb';
import { validCode, type Role } from '@/lib/remoteHub';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  if (!databaseConfigured()) return new Response('database unavailable', { status: 503 });
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
  if (!validCode(code)) return new Response('bad code', { status: 400 });
  try {
    if (event === 'state') await publishRemoteState(code, body.data ?? null);
    else await addRemoteCommand(code, body.data ?? null);
    return Response.json({ ok: true });
  } catch (error) {
    logDatabaseError('remote/send', error);
    return new Response('database error', { status: 500 });
  }
}
