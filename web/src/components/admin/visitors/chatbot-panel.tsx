import type { ChatbotStats } from '@/lib/analytics/queries';
import { BarList } from './bar-list';
import { NoData } from './no-data';

/** Conversations, who answered (FAQ/template/model) and the open knowledge gaps. */
export function ChatbotPanel({ stats }: { stats: ChatbotStats }) {
  const answers = [
    { label: 'Answered instantly from FAQs', value: stats.answers.faq },
    { label: 'Answered from templates', value: stats.answers.template },
    { label: 'Answered by the model', value: stats.answers.model },
    { label: 'Handed to a person', value: stats.answers.handoff },
    { label: 'Fallback reply', value: stats.answers.fallback },
  ].filter((item) => item.value > 0);

  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-2 gap-4">
        <div>
          <dt className="eyebrow">Conversations</dt>
          <dd className="mt-1 font-display text-3xl tabular-nums">{stats.conversations.toLocaleString('en-LK')}</dd>
        </div>
        <div>
          <dt className="eyebrow">Answered instantly</dt>
          <dd className="mt-1 font-display text-3xl tabular-nums">{Math.round(stats.instantShare)}%</dd>
          <dd className="mt-1 text-xs text-mute">FAQs and templates, {Math.round(stats.modelShare)}% by the model</dd>
        </div>
      </dl>

      <div>
        <h3 className="text-base sm:text-sm font-semibold">Who answered</h3>
        <div className="mt-3">
          <BarList items={answers} unit="answers" />
        </div>
      </div>

      <div>
        <h3
          className="text-base sm:text-sm font-semibold"
        >
          Open knowledge gaps ({stats.openGapCount.toLocaleString('en-LK')})
        </h3>
        {stats.openGaps.length ? (
          <ol className="mt-3 space-y-2 text-base sm:text-sm">
            {stats.openGaps.map((gap) => (
              <li
                key={gap.question}
                className={
                  'flex flex-wrap items-baseline justify-between gap-3 border-b border-line/70 pb-2 ' +
                  'last:border-0'
                }
              >
                <span>{gap.question}</span>
                <span className="shrink-0 tabular-nums text-mute">×{gap.timesAsked.toLocaleString('en-LK')}</span>
              </li>
            ))}
          </ol>
        ) : (
          <NoData />
        )}
      </div>
    </div>
  );
}
