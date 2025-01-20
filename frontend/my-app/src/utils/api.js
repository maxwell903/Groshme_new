
import { supabase } from '@/lib/supabaseClient';

export const API_URL = 'https://groshmebeta-05487aa160b2.herokuapp.com';
export const fetchApi = async (endpoint, options = {}) => {
  const session = await supabase.auth.getSession();
  const token = session?.data?.session?.access_token;

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : '',
    ...options.headers,
  };

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || response.statusText);
  }

  return response.json();
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