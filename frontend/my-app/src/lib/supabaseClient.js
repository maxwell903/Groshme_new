import { createClient } from '@supabase/supabase-js';

// Explicit error handling and logging
export const supabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  {
    // Add additional configuration options
    auth: {
      persistSession: true,
      // Add more detailed error handling
      onError: (error) => {
        console.error('Supabase Auth Error:', error);
      }
    }
  }
);

// Create a safe wrapper for state change emitters
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
      } else {
        console.warn(`No valid emitter found for key: ${key}`);
      }
    }
  };
};