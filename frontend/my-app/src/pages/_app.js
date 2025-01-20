// pages/_app.js
import '@/styles/globals.css'
import { useEffect, useState } from 'react'
import { AuthProvider } from '@/contexts/AuthContext'
import Layout from '@/components/Layout'
import { supabase } from '@/lib/supabaseClient'

function MyApp({ Component, pageProps }) {
  const [supabaseInitialized, setSupabaseInitialized] = useState(false)

  useEffect(() => {
    const initializeSupabase = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;

        // Store the token if session exists
        if (session) {
          localStorage.setItem('access_token', session.access_token);
        }
        
        setSupabaseInitialized(true);
      } catch (error) {
        console.error('Error initializing Supabase:', error);
        setSupabaseInitialized(true);
      }
    };

    initializeSupabase();

    // Set up auth state change listener
    const { subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        localStorage.setItem('access_token', session.access_token);
      } else {
        localStorage.removeItem('access_token');
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  if (!supabaseInitialized) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  // Don't wrap sign-in/sign-up pages with Layout
  if (Component.noLayout) {
    return (
      <AuthProvider>
        <Component {...pageProps} />
      </AuthProvider>
    );
  }

  return (
    <AuthProvider>
      <Layout>
        <Component {...pageProps} />
      </Layout>
    </AuthProvider>
  );
}

export default MyApp;