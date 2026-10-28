import { formatColomboDateTime, type ChatLine } from '@/lib/admin/bookings';

/** What the visitor and the chatbot said before the booking, folded away until staff open it. */
export function Transcript({ lines }: { lines: ChatLine[] }) {
  if (lines.length === 0) {
    return <p className="text-sm text-mute">They used the chat, but no messages were saved.</p>;
  }
  return (
    <details className="rounded-xl border border-line">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
        Chat before the booking ({lines.length} {lines.length === 1 ? 'message' : 'messages'})
      </summary>
      <ol className="space-y-3 border-t border-line p-4">
        {lines.map((line) => (
          <li key={line.id}>
            <p className="eyebrow">
              {line.role === 'user' ? 'Visitor' : 'Assistant'} · {formatColomboDateTime(line.createdAt)}
            </p>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm">{line.text}</p>
          </li>
        ))}
      </ol>
    </details>
  );
}
