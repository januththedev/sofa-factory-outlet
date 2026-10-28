import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { listSynonyms, MAX_UPLOAD_BYTES } from '@/lib/admin/knowledge';
import { GoldenCard } from './golden-card';
import { SynonymEditor } from './synonym-editor';
import { SynonymImport } from './synonym-import';

/**
 * The Synonyms tab. When a visitor types "sectional" the search also looks for "l-shape": each term lists the
 * other words people use for it.
 */
export async function SynonymsPanel() {
  const rows = await listSynonyms();
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Synonyms</CardTitle>
            <p className="mt-1 text-sm text-mute">
              Words customers use for the same thing. Searches look for every variant of a term.
            </p>
          </div>
        </CardHeader>
        <SynonymEditor
          rows={rows.map((row) => ({ id: row.id, term: row.term, variants: row.variants, source: row.source }))}
        />
      </Card>
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Import synonyms</CardTitle>
            <p className="mt-1 text-sm text-mute">
              A JSON object such as {'{ "l-shape": ["corner sofa", "sectional"] }'}. Up to 1 MB. Terms in the file
              replace their stored variants; other terms are left alone.
            </p>
          </div>
        </CardHeader>
        <CardBody>
          <SynonymImport maxBytes={MAX_UPLOAD_BYTES} />
        </CardBody>
      </Card>
      <GoldenCard />
    </div>
  );
}
