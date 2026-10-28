import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';
import { FunnelChart } from '@/components/admin/visitors/funnel-chart';
import { funnelWording } from '@/components/admin/visitors/funnel-wording';
import type { FunnelStep } from '@/lib/analytics/queries';

describe('funnel wording', () => {
  it('describes one person leaving without a minus sign', () => {
    expect(funnelWording({ dropOff: 1, dropOffPct: 100 })).toBe('1 left before this step (100%)');
  });

  it('rounds percentages and formats larger counts', () => {
    expect(funnelWording({ dropOff: 1200, dropOffPct: 32.6 })).toBe('1,200 left before this step (33%)');
  });

  it('never describes a negative drop-off or percentage', () => {
    expect(funnelWording({ dropOff: 0, dropOffPct: 0 })).toBe('No drop-off');
    expect(funnelWording({ dropOff: -1, dropOffPct: -100 })).toBe('No drop-off');
    expect(funnelWording({ dropOff: 1, dropOffPct: -5 })).toBe('1 left before this step (0%)');
    expect(funnelWording({ dropOff: 1, dropOffPct: 150 })).toBe('1 left before this step (100%)');
  });

  it('uses the same plain wording in the chart and its text alternative', () => {
    const steps: FunnelStep[] = [
      { key: 'visit', label: 'Visit', visitors: 1, conversionPct: 100, dropOff: 0, dropOffPct: 0 },
      { key: 'product', label: 'Product', visitors: 0, conversionPct: 0, dropOff: 1, dropOffPct: 100 },
    ];
    const html = renderToStaticMarkup(createElement(FunnelChart, { steps }));
    expect(html.split('1 left before this step (100%)')).toHaveLength(3);
    expect(html.replace(/<[^>]*>/g, '')).not.toMatch(/[−-]\d/);
  });

  it('shows independently counted later events even when the first step is empty', () => {
    const steps: FunnelStep[] = [
      { key: 'visit', label: 'Visit', visitors: 0, conversionPct: 0, dropOff: 0, dropOffPct: 0 },
      { key: 'product', label: 'Product', visitors: 1, conversionPct: 0, dropOff: 0, dropOffPct: 0 },
    ];
    const html = renderToStaticMarkup(createElement(FunnelChart, { steps }));
    expect(html).toContain('Product');
    expect(html).toContain('No drop-off');
    expect(html).not.toContain('No data yet');
  });
});
