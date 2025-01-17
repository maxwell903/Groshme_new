// pages/auth.js
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession } from '@supabase/auth-helpers-react';
import AuthComponent from '@/components/AuthComponent';

export default function Auth() {
  const session = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session) {
      router.push('/');
    }
  }, [session, router]);

  if (session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center">
      <AuthComponent />
    </div>
  );
}