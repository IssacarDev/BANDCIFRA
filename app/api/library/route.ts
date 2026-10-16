import { databaseConfigured, readLibrary, writeLibrary } from '@/lib/serverDb';
import type { Setlist, Song } from '@/types/song';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validLibrary(value: unknown): value is { songs: Song[]; setlists: Setlist[] } {
  if (!isRecord(value) || !Array.isArray(value.songs) || !Array.isArray(value.setlists)) return false;
  if (value.songs.length > 2_000 || value.setlists.length > 500) return false;
  return value.songs.every((song) => isRecord(song) && typeof song.id === 'string' && typeof song.title === 'string' && Array.isArray(song.blocks))
    && value.setlists.every((list) => isRecord(list) && typeof list.id === 'string' && typeof list.name === 'string' && Array.isArray(list.songIds));
}

function unavailable() {
  return Response.json({ error: 'Banco de dados não configurado.' }, { status: 503 });
}

export async function GET() {
  if (!databaseConfigured()) return unavailable();
  try {
    return Response.json(await readLibrary());
  } catch {
    return Response.json({ error: 'Não foi possível ler a biblioteca.' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  if (!databaseConfigured()) return unavailable();
  const text = await req.text();
  if (text.length > 5_000_000) return new Response('payload grande demais', { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return new Response('json inválido', { status: 400 });
  }
  if (!validLibrary(body)) return new Response('biblioteca inválida', { status: 400 });
  try {
    await writeLibrary(body);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: 'Não foi possível salvar a biblioteca.' }, { status: 500 });
  }
}
