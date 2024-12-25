import { useState, useEffect } from 'react';
import { createPagesBrowserClient } from '@supabase/auth-helpers-nextjs';
import { SessionContextProvider } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/router';
import { supabase } from '../src/lib/supabaseClient';
import '@/styles/globals.css';

function App({ Component, pageProps }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const router = useRouter();
  const [supabaseClient] = useState(() => createPagesBrowserClient());

  useEffect(() => {
    // Check for initial session
    const checkSession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        console.error('Error checking session:', error);
        return;
      }
      
      setUser(session?.user || null);
      setLoading(false);

      if (!session?.user && router.pathname !== '/auth') {
        router.push('/auth');
      }
      const [supabaseClient] = useState(() => createPagesBrowserClient());

  return (
    <SessionContextProvider
      supabaseClient={supabaseClient}
      initialSession={pageProps.initialSession}
    >
      <Component {...pageProps} />
    </SessionContextProvider>
  );
};

    checkSession();

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      if (!session?.user && router.pathname !== '/auth') {
        router.push('/auth');
      } else if (session?.user && router.pathname === '/auth') {
        router.push('/');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  // Show loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  // Public routes that don't require authentication
  const publicRoutes = ['/auth', '/auth/confirm'];
  if (!user && !publicRoutes.includes(router.pathname)) {
    if (typeof window !== 'undefined') {
      router.push('/auth');
    }
    return null;
  }

  return (
    <SessionContextProvider
      supabaseClient={supabaseClient}
      initialSession={pageProps.initialSession}
    >
      <Component {...pageProps} user={user} />
    </SessionContextProvider>
  );
}

export default App;