import { createClient } from '@supabase/supabase-js';

// Create Supabase client
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);

// Optional: Create a wrapper for state change emitters
export const createStateChangeEmitter = () => {
  const stateChangeEmitters = new Map();

  return {
    register: (key, callback) => {
      if (typeof callback !== 'function') {
        console.error(`Invalid callback for key: ${key}`);
        return;
      }
      stateChangeEmitters.set(key, { callback });
    },
    emit: (key, ...args) => {
      const emitter = stateChangeEmitters.get(key);
      if (emitter && typeof emitter.callback === 'function') {
        try {
          emitter.callback(...args);
        } catch (error) {
          console.error(`Error in emitter for key ${key}:`, error);
        }
      }
    }
  };
};