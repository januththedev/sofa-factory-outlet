import { GoldenRunner } from '@/components/admin/chat/golden-runner';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { readLastEval, toEvalView } from '@/lib/admin/knowledge';

/** Shown under every knowledge tab: after a change, run the golden test again and see whether relevance moved. */
export async function GoldenCard() {
  const last = await readLastEval();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Did the change help?</CardTitle>
      </CardHeader>
      <CardBody>
        <GoldenRunner initial={last ? toEvalView(last) : null} />
      </CardBody>
    </Card>
  );
}
