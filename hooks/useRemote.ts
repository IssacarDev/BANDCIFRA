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
  codeRef.current = code;

  useEffect(() => {
    if (!code) return;
    const es = new EventSource(`/api/remote/stream?code=${code}&role=presenter`);
    es.addEventListener('cmd', (e) => {
      try {
        cmdRef.current(JSON.parse((e as MessageEvent).data));
      } catch {
        /* ignora mensagem inválida */
      }
    });
    es.addEventListener('peers', (e) => {
      try {
        setControllers(JSON.parse((e as MessageEvent).data).controllers ?? 0);
      } catch {
        /* ignora */
      }
    });
    es.addEventListener('open', () => {
      last.current = ''; // reconectou: manda o estado de novo
    });
    return () => es.close();
  }, [code]);

  const json = JSON.stringify(state);
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

  return { controllers };
}

/** Lado do celular-controle: recebe o estado e envia comandos. */
export function useRemoteController(code: string) {
  const [state, setState] = useState<RemoteState | null>(null);
  const [presenters, setPresenters] = useState(0);
  const [online, setOnline] = useState(false);

  useEffect(() => {
    if (!code) return;
    const es = new EventSource(`/api/remote/stream?code=${code}&role=controller`);
    es.addEventListener('open', () => setOnline(true));
    es.addEventListener('error', () => setOnline(false));
    es.addEventListener('state', (e) => {
      try {
        setState(JSON.parse((e as MessageEvent).data));
      } catch {
        /* ignora */
      }
    });
    es.addEventListener('peers', (e) => {
      try {
        setPresenters(JSON.parse((e as MessageEvent).data).presenters ?? 0);
      } catch {
        /* ignora */
      }
    });
    return () => es.close();
  }, [code]);

  const send = useCallback((cmd: RemoteCmd) => void post(code, 'cmd', cmd), [code]);
  return { state, presenters, online, send };
}
