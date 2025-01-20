import { supabase } from '@/lib/supabaseClient';

export const API_URL = process.env.NEXT_PUBLIC_API_URL;

export async function fetchWithAuth(endpoint, options = {}) {
  // Get the current session
  const { data: { session } } = await supabase.auth.getSession();
  
  // Get the access token
  const token = session?.access_token;

  // Prepare headers
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
    ...options.headers,
  };

  // Make the request
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  // Handle unauthorized error
  if (response.status === 401) {
    // Optionally redirect to login
    window.location.href = '/signin';
    throw new Error('Unauthorized - Please log in');
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || response.statusText);
  }

  return response.json();
}