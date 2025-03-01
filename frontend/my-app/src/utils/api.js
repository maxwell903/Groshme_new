import { supabaseClient } from '@/lib/supabaseClient';
import {router} from 'next/router';

export const API_URL = 'https://groshmebeta-05487aa160b2.herokuapp.com';

export const fetchApi = async (endpoint, options = {}) => {
  // Try to get token directly from localStorage first (client-side only)
  let token = null;
  
  if (typeof window !== 'undefined') {
    token = localStorage.getItem('access_token');
  }
  
  // If no token is available and we're client-side, redirect to login
  if (!token && typeof window !== 'undefined' && !options.skipAuthRedirect) {
    console.log('No auth token found, redirecting to login');
    router.push('/signin');
    throw new Error('Authentication required');
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : '',
    ...options.headers,
  };

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      // Handle authentication errors - redirect to login
      if (response.status === 401 && typeof window !== 'undefined' && !options.skipAuthRedirect) {
        console.log('Authentication failed, redirecting to login');
        localStorage.removeItem('access_token');  // Clear invalid token
        router.push('/signin');
        throw new Error('Authentication expired. Please sign in again.');
      }

      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || response.statusText || 'API request failed');
    }

    return response.json();
  } catch (error) {
    console.error(`API Error (${endpoint}):`, error);
    throw error;
  }
};

export const supabaseApi = {
  async addItem(userId, data) {
    const client = supabaseClient(userId);
    return client
      .from('items')
      .insert([data])
      .select();
  },
  async getItems(userId) {
    const client = supabaseClient(userId);
    return client
      .from('items')
      .select('*')
      .order('created_at', { ascending: false });
  },

  async updateItem(userId, id, data) {
    const client = supabaseClient(userId);
    return client
      .from('items')
      .update(data)
      .eq('id', id)
      .select();
  },

  async deleteItem(userId, id) {
    const client = supabaseClient(userId);
    return client
      .from('items')
      .delete()
      .eq('id', id);
  }
};