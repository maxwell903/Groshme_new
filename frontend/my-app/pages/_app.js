// _app.js
import { useState } from 'react';

import { SessionContextProvider } from '@supabase/auth-helpers-react';
import { AuthProvider } from '@/contexts/AuthContext';
import '@/styles/globals.css';


import { createPagesSupabaseClient } from '@/lib/supabaseClient';



export default function App({ Component, pageProps }) {
  const [supabaseClient] = useState(() => createPagesSupabaseClient());

  return (
    <SessionContextProvider
      supabaseClient={supabaseClient}
      initialSession={pageProps.initialSession}
    >
      <AuthProvider>
        <Component {...pageProps} />
      </AuthProvider>
    </SessionContextProvider>
  );
}