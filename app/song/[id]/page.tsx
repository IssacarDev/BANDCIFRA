'use client';
import { Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Reader from '@/components/Reader';

function Inner() {
  const { id } = useParams<{ id: string }>();
  const setlist = useSearchParams().get('setlist') ?? undefined;
  const present = useSearchParams().get('present') === '1';
  // key = id: reinicia rolagem/metrônomo ao trocar de música no repertório
  return <Reader key={id} songId={id} setlistId={setlist} present={present} />;
}

export default function SongPage() {
  return (
    <Suspense fallback={<div className="p-6 text-muted" suppressHydrationWarning>Carregando…</div>}>
      <Inner />
    </Suspense>
  );
}
