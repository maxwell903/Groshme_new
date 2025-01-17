import { getAccessToken } from '../lib/supabaseClient';

export const API_URL = 'https://groshmebeta-05487aa160b2.herokuapp.com';

export const fetchApi = async (endpoint, options = {}) => {
  try {
    const token = await getAccessToken();
    
    if (!token) {
      // Instead of throwing, return a specific error
      return { error: 'No authenticated session' };
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
};

// Supabase specific functions
export const supabaseApi = {
  async addItem(data) {
    const { supabase } = await import('@/lib/supabaseClient');
    return supabase
      .from('items')
      .insert([data])
      .select();
  },

  async getItems() {
    const { supabase } = await import('@/lib/supabaseClient');
    return supabase
      .from('items')
      .select('*')
      .order('created_at', { ascending: false });
  },

  async updateItem(id, data) {
    const { supabase } = await import('@/lib/supabaseClient');
    return supabase
      .from('items')
      .update(data)
      .eq('id', id)
      .select();
  },

  async deleteItem(id) {
    const { supabase } = await import('@/lib/supabaseClient');
    return supabase
      .from('items')
      .delete()
      .eq('id', id);
  }
};