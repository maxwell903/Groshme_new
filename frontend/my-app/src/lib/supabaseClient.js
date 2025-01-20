import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bvgnlxznztqggtqswovg.supabase.co';
const supabaseKey = userId;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  db: {
    schema: 'public'
  }
});