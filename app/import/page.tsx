import ImportPanel from '@/components/ImportPanel';
import AdminGate from '@/components/AdminGate';

export default function ImportPage() {
  return (
    <AdminGate>
      <ImportPanel />
    </AdminGate>
  );
}
