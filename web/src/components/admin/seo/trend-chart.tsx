'use client';

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export type TrendView = { date: string; label: string; clicks: number; impressions: number };

const AXIS_TICK = { fontSize: 12, fill: '#6f6862' };
const TOOLTIP_STYLE = { background: '#fbf9f5', border: '1px solid #ddd5c8', borderRadius: 8, fontSize: 12 };

/** Clicks and impressions per day for the priority searches. The table under it is the text alternative. */
export function TrendChart({ data }: { data: TrendView[] }) {
  const clicks = data.reduce((sum, point) => sum + point.clicks, 0);
  const impressions = data.reduce((sum, point) => sum + point.impressions, 0);
  const summary =
    `Line chart of daily clicks and impressions for the priority searches over ${data.length} days: ` +
    `${clicks} clicks and ${impressions} impressions in total.`;

  return (
    <div>
      <div className="h-64 w-full" role="img" aria-label={summary}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 0, bottom: 0, left: -16 }}>
            <CartesianGrid stroke="#ddd5c8" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} interval="preserveStartEnd" />
            <YAxis
              yAxisId="clicks"
              allowDecimals={false}
              width={44}
              tick={AXIS_TICK}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              yAxisId="impressions"
              orientation="right"
              allowDecimals={false}
              width={44}
              tick={AXIS_TICK}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Line
              yAxisId="clicks"
              type="monotone"
              dataKey="clicks"
              name="Clicks"
              stroke="#842323"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              yAxisId="impressions"
              type="monotone"
              dataKey="impressions"
              name="Impressions"
              stroke="#c9a88a"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-mute">
        <span>
          <span aria-hidden="true" className="mr-1.5 inline-block h-0.5 w-4 bg-maroon align-middle" />
          Clicks (left scale)
        </span>
        <span>
          <span aria-hidden="true" className="mr-1.5 inline-block h-0.5 w-4 bg-clay align-middle" />
          Impressions (right scale)
        </span>
      </p>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-mute">View as table</summary>
        <div className="mt-2 max-h-72 overflow-auto">
          <table className="w-full border-collapse text-left text-sm">
            <caption className="sr-only">Daily clicks and impressions for the priority searches</caption>
            <thead className="border-b border-line text-xs uppercase tracking-wider text-mute">
              <tr>
                <th className="px-4 py-2 font-semibold">Day</th>
                <th className="px-4 py-2 text-right font-semibold">Clicks</th>
                <th className="px-4 py-2 text-right font-semibold">Impressions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.map((point) => (
                <tr key={point.date}>
                  <td className="px-4 py-2">{point.label}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{point.clicks}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{point.impressions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
