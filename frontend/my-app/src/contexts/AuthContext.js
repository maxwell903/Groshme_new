import { createContext, useContext, useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabaseClient } from '@/lib/supabaseClient'

const AuthContext = createContext({})

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    // Check active sessions
    const checkUser = async () => {
      try {
        const { data: { session }, error } = await supabaseClient.auth.getSession()
        setUser(session?.user ?? null)
      } catch (error) {
        console.error('Error checking auth session:', error)
      } finally {
        setLoading(false)
      }
    }

    checkUser()

    // Listen for changes
    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => {
      if (subscription) subscription.unsubscribe()
    }
  }, [])

  const value = {
    user,
    loading,
    signIn: (data) => supabaseClient.auth.signInWithPassword(data),
    signUp: (data) => supabaseClient.auth.signUp(data),
    signOut: () => supabaseClient.auth.signOut()
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}