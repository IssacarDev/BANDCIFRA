'use client';
import { useParams } from 'next/navigation';
import Editor from '@/components/Editor';
import AdminGate from '@/components/AdminGate';

export default function EditPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <AdminGate>
      <Editor key={id} songId={id} />
    </AdminGate>
  );
}
