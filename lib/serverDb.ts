import { neon } from '@neondatabase/serverless';
import { DEMO_SONG } from '@/lib/demo';
import type { Setlist, Song } from '@/types/song';

type StoredLibrary = { songs: Song[]; setlists: Setlist[] };
type RemoteCommandRow = { id: number | string; payload: unknown };

let schemaReady: Promise<void> | undefined;

export function databaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

function sql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL não está configurada.');
  return neon(url);
}

/** Cria as tabelas automaticamente na primeira chamada, inclusive em um banco Neon novo. */
async function ensureSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      const db = sql();
      await db`
        CREATE TABLE IF NOT EXISTS bandcifras_library (
          id SMALLINT PRIMARY KEY CHECK (id = 1),
          songs JSONB NOT NULL,
          setlists JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      await db`
        CREATE TABLE IF NOT EXISTS bandcifras_remote_rooms (
          code VARCHAR(12) PRIMARY KEY,
          state JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      await db`
        CREATE TABLE IF NOT EXISTS bandcifras_remote_commands (
          id BIGSERIAL PRIMARY KEY,
          code VARCHAR(12) NOT NULL,
          payload JSONB NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      await db`
        CREATE INDEX IF NOT EXISTS bandcifras_remote_commands_code_id
        ON bandcifras_remote_commands (code, id)
      `;
    })().catch((error) => {
      // Uma falha transitória do Neon não deixa a instância inutilizável para sempre.
      schemaReady = undefined;
      throw error;
    });
  }
  return schemaReady;
}

export async function readLibrary(): Promise<StoredLibrary> {
  await ensureSchema();
  const db = sql();
  await db`
    INSERT INTO bandcifras_library (id, songs, setlists)
    VALUES (1, ${JSON.stringify([DEMO_SONG])}::jsonb, '[]'::jsonb)
    ON CONFLICT (id) DO NOTHING
  `;
  const rows = await db`SELECT songs, setlists FROM bandcifras_library WHERE id = 1`;
  const row = rows[0] as { songs: Song[]; setlists: Setlist[] } | undefined;
  if (!row) throw new Error('Não foi possível carregar a biblioteca.');
  return { songs: row.songs, setlists: row.setlists };
}

export async function writeLibrary(library: StoredLibrary) {
  await ensureSchema();
  const db = sql();
  await db`
    INSERT INTO bandcifras_library (id, songs, setlists, updated_at)
    VALUES (1, ${JSON.stringify(library.songs)}::jsonb, ${JSON.stringify(library.setlists)}::jsonb, now())
    ON CONFLICT (id) DO UPDATE
    SET songs = EXCLUDED.songs, setlists = EXCLUDED.setlists, updated_at = now()
  `;
}

export async function publishRemoteState(code: string, state: unknown) {
  await ensureSchema();
  const db = sql();
  await db`
    INSERT INTO bandcifras_remote_rooms (code, state, updated_at)
    VALUES (${code}, ${JSON.stringify(state)}::jsonb, now())
    ON CONFLICT (code) DO UPDATE SET state = EXCLUDED.state, updated_at = now()
  `;
}

export async function readRemoteState(code: string) {
  await ensureSchema();
  const db = sql();
  const rows = await db`
    SELECT state FROM bandcifras_remote_rooms
    WHERE code = ${code} AND updated_at > now() - interval '45 seconds'
  `;
  return (rows[0] as { state: unknown } | undefined)?.state ?? null;
}

export async function addRemoteCommand(code: string, command: unknown) {
  await ensureSchema();
  const db = sql();
  await db`INSERT INTO bandcifras_remote_commands (code, payload) VALUES (${code}, ${JSON.stringify(command)}::jsonb)`;
}

export async function readRemoteCommands(code: string, after: number) {
  await ensureSchema();
  const db = sql();
  const cursors = await db`SELECT COALESCE(MAX(id), 0) AS id FROM bandcifras_remote_commands WHERE code = ${code}`;
  const rows = await db`
    SELECT id, payload FROM bandcifras_remote_commands
    WHERE code = ${code} AND id > ${after} AND created_at > now() - interval '30 minutes'
    ORDER BY id ASC
    LIMIT 50
  `;
  return {
    latestId: Number((cursors[0] as { id: number | string } | undefined)?.id ?? 0),
    commands: (rows as RemoteCommandRow[]).map((row) => ({ id: Number(row.id), payload: row.payload })),
  };
}
