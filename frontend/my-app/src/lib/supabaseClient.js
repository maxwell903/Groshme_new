import { createClient } from '@supabase/supabase-js';

export const supabaseClient = (userId) => {
  const supabaseUrl = 'https://bvgnlxznztqggtqswovg.supabase.co';
  const supabaseKey = userId;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
    db: {
      schema: 'public'
    }
  });
};