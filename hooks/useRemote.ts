'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { RemoteCmd, RemoteState } from '@/lib/remoteProto';

const post = (code: string, event: 'state' | 'cmd', data: unknown) =>
  fetch('/api/remote/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, event, data }),
    keepalive: true,
  }).catch(() => {});

/** Lado da apresentação: recebe comandos do celular e publica o estado atual. */
export function useRemoteHost(code: string, state: RemoteState, onCommand: (c: RemoteCmd) => void) {
  const [controllers, setControllers] = useState(0);
  const cmdRef = useRef(onCommand);
  cmdRef.current = onCommand;
  const last = useRef('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const codeRef = useRef(code);
  const stateRef = useRef('');
  codeRef.current = code;

  useEffect(() => {
    if (!code) return;
    let active = true;
    let after = 0;
    let lastCommandAt = 0;
    let initialized = false;
    const poll = async () => {
      try {
        const response = await fetch(`/api/remote/commands?code=${code}&after=${after}`, { cache: 'no-store' });
        if (!response.ok) return;
        const body = await response.json() as { latestId?: number; commands?: { id: number; payload: RemoteCmd }[] };
        // Ao abrir uma nova apresentação, ignora comandos de uma sessão anterior com o mesmo código.
        if (!initialized) {
          after = Math.max(after, body.latestId ?? 0);
          initialized = true;
          return;
        }
        for (const command of body.commands ?? []) {
          after = Math.max(after, command.id);
          cmdRef.current(command.payload);
          lastCommandAt = Date.now();
          setControllers(1);
        }
        if (Date.now() - lastCommandAt > 15_000) setControllers(0);
      } catch {
        // A próxima consulta tenta reconectar.
      }
    };
    void poll();
    const id = setInterval(() => { if (active) void poll(); }, 700);
    return () => { active = false; clearInterval(id); };
  }, [code]);

  const json = JSON.stringify(state);
  stateRef.current = json;
  useEffect(() => {
    if (!code || json === last.current) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      last.current = json;
      void post(codeRef.current, 'state', JSON.parse(json));
    }, 120);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [json, code, controllers]);

  // Mantém a apresentação marcada como ativa mesmo quando o estado visual não muda.
  useEffect(() => {
    if (!code) return;
    const id = setInterval(() => {
      try {
        void post(codeRef.current, 'state', JSON.parse(stateRef.current));
      } catch {
        /* estado ainda não inicializado */
      }
    }, 15_000);
    return () => clearInterval(id);
  }, [code]);

  return { controllers };
}

/** Lado do celular-controle: recebe o estado e envia comandos. */
export function useRemoteController(code: string) {
  const [state, setState] = useState<RemoteState | null>(null);
  const [presenters, setPresenters] = useState(0);
  const [online, setOnline] = useState(false);

  useEffect(() => {
    if (!code) return;
    let active = true;
    const poll = async () => {
      try {
        const response = await fetch(`/api/remote/state?code=${code}`, { cache: 'no-store' });
        if (!response.ok) throw new Error('remote unavailable');
        const body = await response.json() as { state?: RemoteState | null };
        if (!active) return;
        setState(body.state ?? null);
        setPresenters(body.state ? 1 : 0);
        setOnline(true);
      } catch {
        if (active) setOnline(false);
      }
    };
    void poll();
    const id = setInterval(() => { void poll(); }, 700);
    return () => { active = false; clearInterval(id); };
  }, [code]);

  const send = useCallback((cmd: RemoteCmd) => void post(code, 'cmd', cmd), [code]);
  return { state, presenters, online, send };
}
