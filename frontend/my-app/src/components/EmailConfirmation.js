import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';
const API_URL = process.env.NEXT_PUBLIC_API_URL

const EmailConfirmation = () => {
  const router = useRouter();

  useEffect(() => {
    // Get the hash fragment from the URL
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.substring(1));
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const error = params.get('error');
    const errorDescription = params.get('error_description');

    const handleEmailConfirmation = async () => {
      if (error) {
        // Handle error cases
        if (error === 'access_denied' && errorDescription?.includes('expired')) {
          alert('Email confirmation link has expired. Please request a new one.');
        } else {
          alert(`Error: ${errorDescription || 'Something went wrong'}`);
        }
        router.push('/auth'); // Redirect to auth page
        return;
      }

      if (accessToken && refreshToken) {
        // Set the session in Supabase
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        });

        if (sessionError) {
          alert('Error confirming email. Please try again.');
          router.push('/auth');
          return;
        }

        // Email confirmed successfully
        alert('Email confirmed successfully!');
        router.push('/'); // Redirect to home page
      }
    };

    handleEmailConfirmation();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-lg shadow-md">
        <h1 className="text-xl font-semibold mb-4">Confirming your email...</h1>
        <p className="text-gray-600">Please wait while we verify your email address.</p>
      </div>
    </div>
  );
};

export default EmailConfirmation;