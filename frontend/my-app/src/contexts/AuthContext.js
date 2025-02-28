// contexts/AuthContext.js
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/router';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Check for existing session
    const checkUser = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Session error:', error);
          setLoading(false);
          return;
        }
        
        if (data?.session) {
          setSession(data.session);
          setUser(data.session.user);
          
          // Store the current access token
          localStorage.setItem('supabase.auth.token', data.session.access_token);
        } else {
          // If we're not on an auth page, redirect to signin
          const authPaths = ['/signin', '/signup', '/auth/confirm'];
          if (!authPaths.includes(router.pathname)) {
            router.push('/signin');
          }
        }
      } catch (error) {
        console.error('Error checking auth status:', error);
      } finally {
        setLoading(false);
      }
    };

    checkUser();

    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event);
        
        if (session) {
          setSession(session);
          setUser(session.user);
          localStorage.setItem('supabase.auth.token', session.access_token);
          
          // Also update user record in backend if needed
          if (event === 'SIGNED_IN') {
            try {
              await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/user`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({
                  user_id: session.user.id,
                  email: session.user.email
                })
              });
            } catch (err) {
              console.error('Error updating user record:', err);
            }
          }
        } else {
          setSession(null);
          setUser(null);
          localStorage.removeItem('supabase.auth.token');
          
          // Only redirect to signin if we're not already on an auth page
          const authPaths = ['/signin', '/signup', '/auth/confirm'];
          if (!authPaths.includes(router.pathname)) {
            router.push('/signin');
          }
        }
      }
    );

    return () => {
      subscription?.unsubscribe();
    };
  }, [router]);

  const value = {
    user,
    session,
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