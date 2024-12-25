// api.js
export const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export const fetchApi = async (endpoint, options = {}) => {
  try {
   
      console.log('Fetching:', `${API_URL}${endpoint}`); // Add this line
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  } catch (error) {
    console.error('API Error:', error, 'Endpoint:', endpoint); // Enhance error logging
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