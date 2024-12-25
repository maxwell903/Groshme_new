import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bvgnlxznztqggtqswovg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2Z25seHpuenRxZ2d0cXN3b3ZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ5MDI1ODIsImV4cCI6MjA1MDQ3ODU4Mn0.I8alzEBJYt_D1PDZHvuyZzLzlAEANTGkeR3IRyp1gCc';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  db: {
    schema: 'public'
  }
});