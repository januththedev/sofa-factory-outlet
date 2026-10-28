import type { FunnelStep } from '@/lib/analytics/queries';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { NoData } from './no-data';

/** Visit → product view → cart → booking, with the drop at every step. */
export function FunnelChart({ steps }: { steps: FunnelStep[] }) {
  const top = steps[0]?.visitors ?? 0;
  if (!top) return <NoData />;
  const max = Math.max(...steps.map((step) => step.visitors), 1);

  return (
    <div>
      <ol className="space-y-4">
        {steps.map((step, index) => (
          <li key={step.key}>
            <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
              <span className="font-medium">{step.label}</span>
              <span className="tabular-nums">
                {step.visitors.toLocaleString('en-LK')}{' '}
                <span className="text-mute">({Math.round(step.conversionPct)}% of visitors)</span>
              </span>
            </div>
            <div className="mt-1 h-3 overflow-hidden rounded-full bg-bone-2">
              <div
                className="h-3 rounded-full bg-maroon/80"
                style={{ width: step.visitors ? `${Math.max(2, Math.round((step.visitors / max) * 100))}%` : '0%' }}
              />
            </div>
            {index > 0 ? (
              <p className="mt-1 text-xs text-mute">
                {step.dropOff > 0
                  ? `−${step.dropOff.toLocaleString('en-LK')} (${Math.round(step.dropOffPct)}% drop-off)`
                  : 'No drop-off'}
              </p>
            ) : null}
          </li>
        ))}
      </ol>
      <details className="mt-4 text-sm">
        <summary className="cursor-pointer text-mute">View as table</summary>
        <Table className="mt-2">
          <caption className="sr-only">Funnel steps and drop-off</caption>
          <THead>
            <TR>
              <TH>Step</TH>
              <TH className="text-right">Visitors</TH>
              <TH className="text-right">Of visitors</TH>
              <TH className="text-right">Drop-off</TH>
            </TR>
          </THead>
          <TBody>
            {steps.map((step) => (
              <TR key={step.key}>
                <TD>{step.label}</TD>
                <TD className="text-right tabular-nums">{step.visitors.toLocaleString('en-LK')}</TD>
                <TD className="text-right tabular-nums">{Math.round(step.conversionPct)}%</TD>
                <TD className="text-right tabular-nums">
                  {step.dropOff > 0 ? `${step.dropOff.toLocaleString('en-LK')} (${Math.round(step.dropOffPct)}%)` : '—'}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </details>
    </div>
  );
}
