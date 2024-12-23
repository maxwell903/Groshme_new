// src/pages/_app.js
import { useState, useEffect } from 'react'
import { createPagesBrowserClient } from '@supabase/auth-helpers-nextjs'
import { SessionContextProvider } from '@supabase/auth-helpers-react'
import { useRouter } from 'next/router'
import '@/styles/globals.css'

function App({ Component, pageProps }) {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  const router = useRouter()
  // Create a single supabase client for the entire session
  const [supabaseClient] = useState(() => createPagesBrowserClient())

  useEffect(() => {
    // Check for initial session
    const checkSession = async () => {
      const { data: { session } } = await supabaseClient.auth.getSession()
      setUser(session?.user || null)
      setLoading(false)

      // Set up auth state listener
      const { data: { subscription } } = supabaseClient.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user || null)
        if (!session?.user && router.pathname !== '/auth') {
          router.push('/auth')
        }
      })

      return () => {
        subscription.unsubscribe()
      }
    }

    checkSession()
  }, [router, supabaseClient])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Loading...</div>
      </div>
    )
  }

  // If no user and not on auth page, redirect to auth
  if (!user && router.pathname !== '/auth') {
    if (typeof window !== 'undefined') {
      router.push('/auth')
    }
    return null
  }

  // If user is trying to access auth page while logged in, redirect to home
  if (user && router.pathname === '/auth') {
    if (typeof window !== 'undefined') {
      router.push('/')
    }
    return null
  }

  return (
    <SessionContextProvider
      supabaseClient={supabaseClient}
      initialSession={pageProps.initialSession}
    >
      <Component {...pageProps} user={user} />
    </SessionContextProvider>
  )
}

export default App