
// utils/api.js
import { supabase } from '@/lib/supabaseClient';

export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://groshmebeta-05487aa160b2.herokuapp.com';

export const fetchApi = async (endpoint, options = {}) => {
  // First try to get the current active session
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  
  if (sessionError) {
    console.error('Error getting session:', sessionError);
    throw new Error('Authentication error');
  }
  
  // Get the current access token
  const token = sessionData?.session?.access_token;
  
  if (!token) {
    console.error('No access token available');
    throw new Error('Authentication required');
  }
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    ...options.headers,
  };

  console.log(`Fetching ${API_URL}${endpoint} with token`);
  
  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      // Special handling for 401 Unauthorized errors
      if (response.status === 401) {
        // Force refresh the session
        const { error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError) {
          console.error('Failed to refresh session:', refreshError);
          throw new Error('Session expired. Please sign in again.');
        }
        
        // Retry the request after refresh
        return fetchApi(endpoint, options);
      }
      
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || response.statusText || `Error: ${response.status}`);
    }

    return response.json();
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
};

// This function can be used for requests that need retry logic
export const fetchWithRetry = async (endpoint, options = {}, maxRetries = 3) => {
  let retries = 0;
  
  while (retries < maxRetries) {
    try {
      return await fetchApi(endpoint, options);
    } catch (error) {
      retries++;
      
      // If we've reached max retries or it's not an auth error, throw
      if (retries >= maxRetries || !error.message.includes('Authentication')) {
        throw error;
      }
      
      // Wait a bit before retrying
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Try to refresh the token before next retry
      try {
        await supabase.auth.refreshSession();
      } catch (refreshError) {
        console.error('Session refresh failed:', refreshError);
      }
    }
  }
};