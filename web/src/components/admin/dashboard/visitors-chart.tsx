'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { NoData } from '@/components/admin/visitors/no-data';

export type VisitorBar = { date: string; label: string; visitors: number };

const AXIS_TICK = { fontSize: 12, fill: '#6f6862' };
const TOOLTIP_STYLE = { background: '#fbf9f5', border: '1px solid #ddd5c8', borderRadius: 8, fontSize: 12 };

/** Visitors per day as small bars. The sentence and the table are the text alternatives for the picture. */
export function VisitorsChart({ data, summary }: { data: VisitorBar[]; summary: string }) {
  if (data.every((day) => day.visitors === 0)) return <NoData />;
  return (
    <div>
      <div role="img" aria-label={summary} className="h-44 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -20 }}>
            <CartesianGrid stroke="#ddd5c8" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} interval="preserveStartEnd" />
            <YAxis allowDecimals={false} width={44} tick={AXIS_TICK} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(132, 35, 35, 0.06)' }} />
            <Bar dataKey="visitors" name="Visitors" fill="#842323" radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-mute">View as table</summary>
        <table className="mt-2 w-full border-collapse text-left text-sm">
          <caption className="sr-only">Visitors per day</caption>
          <thead className="border-b border-line text-xs uppercase tracking-wider text-mute">
            <tr>
              <th className="px-3 py-2 font-semibold">Day</th>
              <th className="px-3 py-2 text-right font-semibold">Visitors</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {data.map((day) => (
              <tr key={day.date}>
                <td className="px-3 py-2">{day.label}</td>
                <td className="px-3 py-2 text-right tabular-nums">{day.visitors.toLocaleString('en-LK')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
