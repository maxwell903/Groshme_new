import { supabaseClient } from '@/lib/supabaseClient';

export const API_URL = 'https://groshmebeta-05487aa160b2.herokuapp.com';

export const fetchApi = async (endpoint, options = {}) => {
  const session = await supabaseClient(options.userId).auth.getSession();
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