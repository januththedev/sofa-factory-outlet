/** Title row used at the top of every admin page. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 sm:mb-8">
      <div className="min-w-0 max-w-full">
        <h1 className="break-words font-display text-3xl leading-tight lg:text-4xl">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl break-words text-mute">{description}</p> : null}
      </div>
      {actions ? (
        <div className="flex w-full min-w-0 flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
