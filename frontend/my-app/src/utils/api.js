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

  console.log(`Fetching ${API_URL}${endpoint}`);
  
  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
      credentials: 'include',  // Include credentials for CORS requests
      mode: 'cors',  // Explicitly set CORS mode
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

// This function can be used for simple API requests without auth
export const fetchWithoutAuth = async (endpoint, options = {}) => {
  const fetchOptions = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    credentials: 'include',
    mode: 'cors',
  };

  try {
    const response = await fetch(`${API_URL}${endpoint}`, fetchOptions);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || response.statusText || `Error: ${response.status}`);
    }
    
    return response.json();
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
};

// Update the function used in index.js to handle errors more gracefully
export const fetchHomeData = async () => {
  try {
    const response = await fetch(`${API_URL}/api/home-data`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      mode: 'cors'
    });
    
    if (!response.ok) {
      console.error('Failed to fetch home data:', response.statusText);
      return {
        total_recipes: 0,
        latest_recipes: []
      };
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching home data:', error);
    return {
      total_recipes: 0,
      latest_recipes: []
    };
  }
};