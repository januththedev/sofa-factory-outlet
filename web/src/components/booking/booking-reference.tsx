'use client';

import { useState } from 'react';

export function BookingReference({ reference }: { reference: string }) {
  const [notice, setNotice] = useState('');
  const [copying, setCopying] = useState(false);
  return (
    <div>
      <p className="mt-3 break-all font-display text-[clamp(2rem,7vw,4.2rem)] leading-none text-maroon">
        {reference}
      </p>
      <button
        type="button"
        disabled={copying}
        className="mt-4 min-h-11 rounded-full border border-line px-5 text-base"
        onClick={async () => {
          setCopying(true);
          try {
            await navigator.clipboard.writeText(reference);
            setNotice('Reference copied.');
          } catch {
            setNotice('Please select and copy the reference above.');
          } finally {
            setCopying(false);
          }
        }}
      >
        {copying ? 'Copying...' : 'Copy reference'}
      </button>
      <p role="status" className="mt-2 min-h-6 text-base text-mute">{notice}</p>
    </div>
  );
}
