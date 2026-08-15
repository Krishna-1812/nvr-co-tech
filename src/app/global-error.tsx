'use client';

import { useEffect } from 'react';
import { logClientError } from '@/lib/errors/client';

/**
 * Last resort: a failure in the root layout itself, where error.tsx cannot
 * render because the layout that wraps it is the thing that broke. It replaces
 * the whole document, so it supplies its own <html> and <body> and cannot rely
 * on the app's stylesheet having loaded.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
    void logClientError({ message: error.message, digest: error.digest, stack: error.stack });
  }, [error]);

  return (
    <html lang="en-IN">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          padding: '2rem',
          fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
          background: '#fafafa',
          color: '#1c1c22',
        }}
      >
        <div style={{ maxWidth: '28rem', textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
            The application could not start
          </h1>
          <p style={{ marginTop: '0.75rem', color: '#5a5a68', lineHeight: 1.6 }}>
            This is a fault in the app itself rather than in your data. Nothing was saved.
          </p>
          {error.digest && (
            <p style={{ marginTop: '1rem', fontSize: '0.75rem', color: '#8a8a99' }}>
              Reference: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              marginTop: '1.5rem',
              height: '2.5rem',
              padding: '0 1rem',
              borderRadius: '0.5rem',
              border: 'none',
              background: '#3D52A0',
              color: 'white',
              fontWeight: 600,
              fontSize: '0.875rem',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
