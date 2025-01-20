import { useState } from 'react';
import { createPagesBrowserClient } from '@supabase/auth-helpers-nextjs';
import { SessionContextProvider } from '@supabase/auth-helpers-react';
import '@/styles/globals.css';
import { AuthProvider } from '../src/components/contexts/AuthContext';

function App({ Component, pageProps }) {
  const [supabaseClient] = useState(() => createPagesBrowserClient());

  return (
    <SessionContextProvider supabaseClient={supabaseClient} initialSession={pageProps.initialSession}>
      <AuthProvider>
        <Component {...pageProps} />
      </AuthProvider>
    </SessionContextProvider>
  );
}