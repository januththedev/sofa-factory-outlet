'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatLkr } from '@/lib/money';

export type RevenueChartPoint = {
  month: string;
  label: string;
  invoiced: number;
  paid: number;
  website: number;
  walkIn: number;
};

function chartSummary(points: readonly RevenueChartPoint[]): string {
  if (!points.length) return 'No revenue has been invoiced in this period.';
  return points.map((point) => {
    const invoiced = formatLkr(Math.round(point.invoiced * 100), { decimals: true });
    const paid = formatLkr(Math.round(point.paid * 100), { decimals: true });
    const website = formatLkr(Math.round(point.website * 100), { decimals: true });
    const walkIn = formatLkr(Math.round(point.walkIn * 100), { decimals: true });
    return `${point.label}: ${invoiced} invoiced (${website} website, ${walkIn} walk-in), ${paid} paid`;
  }).join('; ');
}

export function RevenueChart({ points }: { points: readonly RevenueChartPoint[] }) {
  if (!points.length) {
    return <p className="py-12 text-center text-sm text-mute">No revenue has been invoiced in this period.</p>;
  }
  return (
    <figure>
      <figcaption className="sr-only">Bar chart of monthly revenue. {chartSummary(points)}</figcaption>
      <div aria-hidden="true" className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={points} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
            <CartesianGrid stroke="var(--color-line)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: 'var(--color-mute)', fontSize: 12 }} />
            <YAxis tick={{ fill: 'var(--color-mute)', fontSize: 12 }} width={70} />
            <Tooltip />
            <Legend />
            <Bar dataKey="invoiced" name="Invoiced" fill="var(--color-maroon)" radius={[3, 3, 0, 0]} />
            <Bar dataKey="paid" name="Paid" fill="var(--color-good)" radius={[3, 3, 0, 0]} />
            <Bar dataKey="website" name="Website" fill="var(--color-clay)" radius={[3, 3, 0, 0]} />
            <Bar dataKey="walkIn" name="Walk-in" fill="var(--color-ink-2)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
