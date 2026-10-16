import { databaseConfigured, logDatabaseError, readRemoteCommands } from '@/lib/serverDb';
import { validCode } from '@/lib/remoteHub';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  if (!databaseConfigured()) return new Response('database unavailable', { status: 503 });
  const url = new URL(req.url);
  const code = (url.searchParams.get('code') ?? '').toUpperCase();
  const after = Math.max(0, Number.parseInt(url.searchParams.get('after') ?? '0', 10) || 0);
  if (!validCode(code)) return new Response('bad request', { status: 400 });
  try {
    return Response.json(await readRemoteCommands(code, after));
  } catch (error) {
    logDatabaseError('remote/commands', error);
    return new Response('database error', { status: 500 });
  }
}
