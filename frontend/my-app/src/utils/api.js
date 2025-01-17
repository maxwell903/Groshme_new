
export const API_URL = 'https://groshmebeta-05487aa160b2.herokuapp.com';

export const fetchApi = async (endpoint, options = {}) => {
  try {
    const session = await supabase.auth.getSession();
    const token = session?.data?.session?.access_token;
    
    if (!token) {
      console.error('No auth token found');
      return { error: 'No authenticated session' };
    }

    console.log('Making request to:', `${API_URL}${endpoint}`);
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
      const errorText = await response.text();
      console.error('API Error:', errorText);
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
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