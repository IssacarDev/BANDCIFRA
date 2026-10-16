/**
 * Central do controle remoto (roda no servidor Node do próprio app).
 * Uma "sala" por código: a apresentação (presenter) recebe comandos e envia o estado;
 * os controles (celulares) enviam comandos e recebem o estado.
 */
export type Role = 'presenter' | 'controller';
type Send = (event: string, data: unknown) => void;
interface Sub { role: Role; send: Send }
interface Room { subs: Set<Sub>; lastState: unknown; touched: number }

const g = globalThis as unknown as { __cifraRooms?: Map<string, Room> };
const rooms = (g.__cifraRooms ??= new Map<string, Room>());

export const validCode = (c: unknown): c is string => typeof c === 'string' && /^[A-Z0-9]{4,12}$/.test(c);

function getRoom(code: string): Room {
  let r = rooms.get(code);
  if (!r) {
    r = { subs: new Set(), lastState: null, touched: Date.now() };
    rooms.set(code, r);
  }
  r.touched = Date.now();
  return r;
}

function broadcastPeers(r: Room) {
  const presenters = [...r.subs].filter((s) => s.role === 'presenter').length;
  const controllers = [...r.subs].filter((s) => s.role === 'controller').length;
  r.subs.forEach((s) => s.send('peers', { presenters, controllers }));
}

export function subscribe(code: string, role: Role, send: Send): () => void {
  // limpa salas abandonadas (sem ninguém há mais de 6 horas)
  const now = Date.now();
  rooms.forEach((r, k) => {
    if (!r.subs.size && now - r.touched > 6 * 3600_000) rooms.delete(k);
  });

  const room = getRoom(code);
  const sub: Sub = { role, send };
  room.subs.add(sub);
  if (role === 'controller' && room.lastState) send('state', room.lastState);
  broadcastPeers(room);
  return () => {
    room.subs.delete(sub);
    room.touched = Date.now();
    broadcastPeers(room);
  };
}

export function publish(code: string, to: Role, event: string, data: unknown) {
  const room = getRoom(code);
  if (event === 'state') room.lastState = data;
  room.subs.forEach((s) => s.role === to && s.send(event, data));
}
