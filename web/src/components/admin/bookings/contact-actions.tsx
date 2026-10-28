import { buttonStyles } from '@/components/ui/button';

export function ContactActions({
  callHref,
  whatsappHref,
}: {
  callHref: string | null;
  whatsappHref: string | null;
}) {
  return (
    <div className="grid min-w-0 grid-cols-2 gap-2">
      {callHref ? (
        <a href={callHref} className={buttonStyles({ variant: 'ghost', size: 'sm' })}>Call</a>
      ) : (
        <span className="self-center text-xs text-mute">No phone saved</span>
      )}
      {whatsappHref ? (
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonStyles({ variant: 'ghost', size: 'sm' })}
        >
          WhatsApp
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      ) : (
        <span className="self-center text-xs text-mute">No WhatsApp saved</span>
      )}
    </div>
  );
}
