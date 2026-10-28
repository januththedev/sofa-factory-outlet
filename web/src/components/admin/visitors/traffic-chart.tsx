'use client';

import { Area } from 'recharts';
import { AreaChart } from 'recharts';
import { CartesianGrid } from 'recharts';
import { Legend } from 'recharts';
import { ResponsiveContainer } from 'recharts';
import { Tooltip } from 'recharts';
import { XAxis } from 'recharts';
import { YAxis } from 'recharts';
import { NoData } from './no-data';

export type TrafficPointView = { date: string; label: string; visitors: number; sessions: number; pageViews: number };

const AXIS_TICK = { fontSize: 12, fill: '#6f6862' };
const TOOLTIP_STYLE = { background: '#fbf9f5', border: '1px solid #ddd5c8', borderRadius: 8, fontSize: 12 };

/** Visitors, sessions and page views over time. The table below is the accessible equivalent. */
export function TrafficChart({ data }: { data: TrafficPointView[] }) {
  if (!data.length || data.every((point) => point.visitors === 0 && point.pageViews === 0)) return <NoData />;

  return (
    <div>
      <div className="h-72 w-full" role="img" aria-label="Line chart of visitors, sessions and page views per day">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            <defs>
              <linearGradient id="traffic-visitors" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#842323" stopOpacity={0.28} />
                <stop offset="100%" stopColor="#842323" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="traffic-sessions" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#c9a88a" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#c9a88a" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#ddd5c8" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} interval="preserveStartEnd" />
            <YAxis allowDecimals={false} width={40} tick={AXIS_TICK} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Area
              type="monotone"
              dataKey="visitors"
              name="Visitors"
              stroke="#842323"
              strokeWidth={2}
              fill="url(#traffic-visitors)"
              dot={false}
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="sessions"
              name="Sessions"
              stroke="#c9a88a"
              strokeWidth={2}
              fill="url(#traffic-sessions)"
              dot={false}
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="pageViews"
              name="Page views"
              stroke="#53352a"
              strokeWidth={2}
              fill="transparent"
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <details className="mt-4 text-base sm:text-sm">
        <summary className="min-h-11 cursor-pointer py-3 text-mute">View as table</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full border-collapse text-left text-base sm:text-sm">
            <caption className="sr-only">Visitors, sessions and page views per day</caption>
            <thead className="border-b border-line text-xs uppercase tracking-wider text-mute">
              <tr>
                <th className="px-4 py-3 font-semibold">Day</th>
                <th className="px-4 py-3 text-right font-semibold">Visitors</th>
                <th className="px-4 py-3 text-right font-semibold">Sessions</th>
                <th className="px-4 py-3 text-right font-semibold">Page views</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.map((point) => (
                <tr key={point.date}>
                  <td className="px-4 py-3">{point.label}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{point.visitors.toLocaleString('en-LK')}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{point.sessions.toLocaleString('en-LK')}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{point.pageViews.toLocaleString('en-LK')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
