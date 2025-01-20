// contexts/AuthContext.js
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/router';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Check for existing session
    const checkUser = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        
        if (session) {
          setUser(session.user);
          localStorage.setItem('access_token', session.access_token);
        }
      } catch (error) {
        console.error('Error checking auth status:', error);
      } finally {
        setLoading(false);
      }
    };

    checkUser();

    // Set up auth state change listener
    const { subscription } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        setUser(session.user);
        localStorage.setItem('access_token', session.access_token);
      } else {
        setUser(null);
        localStorage.removeItem('access_token');
        router.push('/signin');
      }
      setLoading(false);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [router]);

  const value = {
    user,
    loading,
    signOut: async () => {
      await supabase.auth.signOut();
      router.push('/signin');
    }
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};