// utils/fetch.js
import { supabase } from '../lib/supabaseClient';

export const fetchWithAuth = async (endpoint, options = {}) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    const headers = {
      'Content-Type': 'application/json',
      ...(session?.access_token && { 'Authorization': `Bearer ${session.access_token}` }),
      ...options.headers
    };

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${endpoint}`, {
      ...options,
      headers,
      credentials: 'include', // Add this line
      mode: 'cors' // Add this line
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || response.statusText);
    }

    return response.json();
  } catch (error) {
    console.error('Fetch error:', error);
    throw error;
  }
};