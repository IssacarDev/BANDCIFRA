import { databaseConfigured, logDatabaseError, readRemoteState } from '@/lib/serverDb';
import { validCode } from '@/lib/remoteHub';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  if (!databaseConfigured()) return new Response('database unavailable', { status: 503 });
  const code = (new URL(req.url).searchParams.get('code') ?? '').toUpperCase();
  if (!validCode(code)) return new Response('bad request', { status: 400 });
  try {
    return Response.json({ state: await readRemoteState(code) });
  } catch (error) {
    logDatabaseError('remote/state', error);
    return new Response('database error', { status: 500 });
  }
}
