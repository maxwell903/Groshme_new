import '@/styles/globals.css'
import { useState, useEffect } from 'react'
import { AuthProvider } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabaseClient'

function MyApp({ Component, pageProps }) {
  const [supabaseInitialized, setSupabaseInitialized] = useState(false)

  useEffect(() => {
    const initializeSupabase = async () => {
      try {
        // Check if Supabase is initialized
        const { data, error } = await supabase.auth.getSession()
        if (error) throw error
        setSupabaseInitialized(true)
      } catch (error) {
        console.error('Error initializing Supabase:', error)
      }
    }

    initializeSupabase()
  }, [])

  if (!supabaseInitialized) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  return (
    <AuthProvider>
      <Component {...pageProps} />
    </AuthProvider>
  )
}

export default MyApp