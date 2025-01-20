// pages/_app.js
import '@/styles/globals.css'
import { useState, useEffect } from 'react'
import { AuthProvider } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabaseClient'

function MyApp({ Component, pageProps }) {
  const [supabaseInitialized, setSupabaseInitialized] = useState(false)

  useEffect(() => {
    const initializeSupabase = async () => {
      try {
        // Verify Supabase initialization
        if (!supabase) {
          throw new Error('Supabase client not initialized');
        }

        // Check if Supabase auth is working
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        
        setSupabaseInitialized(true);
      } catch (error) {
        console.error('Error initializing Supabase:', error);
        // Still set initialized to true to prevent infinite loading
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

  return (
    <AuthProvider>
      <Component {...pageProps} />
    </AuthProvider>
  );
}

export default MyApp;