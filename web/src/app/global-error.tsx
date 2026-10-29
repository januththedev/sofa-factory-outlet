'use client';

// Last resort when even the root layout fails: it replaces the whole document, so it carries its own styles.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#f3efe8', color: '#141211' }}>
        <main style={{ minHeight: '100svh', display: 'grid', placeItems: 'center', padding: '2rem', textAlign: 'center' }}>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 400 }}>Sofa Factory Outlet</h1>
            <p style={{ maxWidth: '28rem', margin: '1rem auto', lineHeight: 1.6 }}>
              Something went wrong on our side. Please try again in a moment.
            </p>
            <button
              type="button"
              onClick={reset}
              style={{ minHeight: 44, padding: '0 1.5rem', borderRadius: 999, border: 0, background: '#842323', color: '#fff', fontSize: '1rem' }}
            >
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
