// pages/auth.js
import AuthComponent from '@/components/AuthComponent';
import { useSession } from '@supabase/auth-helpers-react';
import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function Auth() {
  const session = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session) {
      router.push('/'); // Redirect to home if already authenticated
    }
  }, [session, router]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center">
      <AuthComponent />
    </div>
  );
}