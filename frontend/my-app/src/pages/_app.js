// pages/_app.js
import '@/styles/globals.css'
import { useState, useEffect } from 'react'
import { AuthProvider } from '@/contexts/AuthContext'
import Layout from '@/components/Layout'
import { supabase } from '@/lib/supabaseClient'

function MyApp({ Component, pageProps }) {
  const [supabaseInitialized, setSupabaseInitialized] = useState(false)

  useEffect(() => {
    const initializeSupabase = async () => {
      try {
        if (!supabase) {
          throw new Error('Supabase client not initialized');
        }
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        setSupabaseInitialized(true);
      } catch (error) {
        console.error('Error initializing Supabase:', error);
        setSupabaseInitialized(true);
      }
    };

    initializeSupabase();
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