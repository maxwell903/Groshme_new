import { createClient } from '@supabase/supabase-js';
import { useState, useEffect } from 'react';

function MyApp({ Component, pageProps }) {
  const [supabase] = useState(() => 
    createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL, 
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )
  );

  useEffect(() => {
    // Safe session handling
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        try {
          console.log('Auth state changed:', event, session);
          // Handle session changes safely
        } catch (error) {
          console.error('Error in auth state change:', error);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  return <Component {...pageProps} />;
}

export default MyApp;