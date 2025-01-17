// pages/auth/callback.js
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSupabaseClient } from '@supabase/auth-helpers-react';

export default function AuthCallback() {
  const router = useRouter();
  const supabase = useSupabaseClient();

  useEffect(() => {
    const { code } = router.query;

    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ data, error }) => {
        if (!error) {
          router.push('/');
        }
      });
    }
  }, [router.query]);

  return <div>Processing...</div>;
}