import { Badge } from '@/components/ui/badge';
import type { PreviewChunk } from '@/lib/admin/knowledge';

const SHOWN = 60;

/** The chunks exactly as the chatbot reads them: heading path, text and tags. */
export function ChunkPreview({ chunks, title }: { chunks: PreviewChunk[]; title?: string }) {
  if (chunks.length === 0) {
    return <p className="text-sm text-mute">Nothing in this file becomes a chunk, so the bot would not see it.</p>;
  }
  return (
    <div>
      <h3 className="font-semibold">
        {title ?? 'How the bot will see it'} ({chunks.length} {chunks.length === 1 ? 'chunk' : 'chunks'})
      </h3>
      <ol className="mt-3 space-y-3">
        {chunks.slice(0, SHOWN).map((chunk, index) => (
          <li key={`${index}-${chunk.headingPath}`} className="rounded-xl border border-line bg-bone/50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-mute">{chunk.headingPath}</p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-ink-2">{chunk.body}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-mute">
              {chunk.tags.map((tag) => (
                <Badge key={tag} tone="neutral">
                  {tag}
                </Badge>
              ))}
              {chunk.priority === 'high' ? <Badge tone="maroon">High priority</Badge> : null}
              <span>About {chunk.tokens} tokens</span>
            </div>
          </li>
        ))}
      </ol>
      {chunks.length > SHOWN ? (
        <p className="mt-3 text-sm text-mute">…and {chunks.length - SHOWN} more chunks.</p>
      ) : null}
    </div>
  );
}
