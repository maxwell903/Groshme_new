import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://jaffvbrrriaxibqsrbwb.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImphZmZ2YnJycmlheGlicXNyYndiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ4OTc3NDEsImV4cCI6MjA1MDQ3Mzc0MX0.-K6poq8dVzy_Wz2_kexk8ckBNRO_YlsoZ8YX7ySlKhs');

export { supabase };