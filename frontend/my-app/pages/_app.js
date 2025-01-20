import '@/styles/globals.css'
import { AuthProvider } from '@/contexts/AuthContext'
import { supabaseClient } from '@/lib/supabaseClient'
import { SessionContextProvider } from '@supabase/auth-helpers-react'

export default function MyApp({ Component, pageProps }) {
  return (
    <SessionContextProvider supabaseClient={supabaseClient} initialSession={pageProps.initialSession}>
      <AuthProvider>
        <Component {...pageProps} />
      </AuthProvider>
    </SessionContextProvider>
  )
}