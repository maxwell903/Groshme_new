// pages/signup.js
import { supabase } from '../lib/supabaseClient'

const SignUp = () => {
  const handleSignUp = async (e) => {
    e.preventDefault()
    // Get form data (email, password, etc.)
    const { email, password } = e.target.elements
    
    try {
      const { user, error } = await supabase.auth.signUp({
        email: email.value,
        password: password.value,
      })
      
      if (error) throw error
      
      // Create a new user record in the Supabase database
      await supabase.from('users').insert({ id: user.id, email: user.email })
    } catch (error) {
      console.error('Error signing up:', error)
    }
  }

  return (
    <form onSubmit={handleSignUp}>
      {/* Sign up form fields */}
    </form>
  )
}

export default SignUp