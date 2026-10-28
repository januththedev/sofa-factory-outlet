import { requireRole } from '@/lib/auth/session';
import { PageHeader } from '@/components/admin/page-header';
import { CsvImport } from '@/components/admin/products/csv-import';

export default async function ImportProductsPage() {
  await requireRole('any');
  return (
    <>
      <PageHeader title="Import products" description="Validate every line before any product is written." />
      <CsvImport />
    </>
  );
}
