type ContentsItem = {
  id: string;
  text: string;
  depth?: number;
};

type PageContentsProps = {
  items: ContentsItem[];
  label?: string;
};

/** Native disclosure works before hydration and keeps long pages easy to scan. */
export function PageContents({ items, label = 'On this page' }: PageContentsProps) {
  if (items.length === 0) return null;

  return (
    <details className="min-w-0 rounded-[var(--radius-card)] border border-line bg-paper p-3">
      <summary className="min-h-11 min-w-11 cursor-pointer content-center px-2 text-base font-semibold">
        {label}
      </summary>
      <nav aria-label={label} className="mt-2 border-t border-line pt-2">
        <ol className="space-y-2">
          {items.map((item) => (
            <li key={item.id} className={item.depth === 3 ? 'pl-4' : undefined}>
              <a
                href={`#${item.id}`}
                className="flex min-h-11 min-w-11 items-center break-words px-2 py-2 text-base leading-relaxed"
              >
                {item.text}
              </a>
            </li>
          ))}
        </ol>
      </nav>
    </details>
  );
}
