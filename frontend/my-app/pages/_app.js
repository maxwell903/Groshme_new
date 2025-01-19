import { useState } from 'react';
import { createPagesBrowserClient } from '@supabase/auth-helpers-nextjs';
import { SessionContextProvider } from '@supabase/auth-helpers-react';
import '@/styles/globals.css';

function App({ Component, pageProps }) {
  const [supabaseClient] = useState(() => createPagesBrowserClient({
    supabaseUrl: 'https://bvgnlxznztqggtqswovg.supabase.co',
    supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2Z25seHpuenRxZ2d0cXN3b3ZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ5MDI1ODIsImV4cCI6MjA1MDQ3ODU4Mn0.I8alzEBJYt_D1PDZHvuyZzLzlAEANTGkeR3IRyp1gCc'
  }));

  return (
    <SessionContextProvider
      supabaseClient={supabaseClient}
      initialSession={pageProps.initialSession}
    >
      <Component {...pageProps} />
    </SessionContextProvider>
  );
}

export default App;