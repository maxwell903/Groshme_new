export const fetchWithAuth = async (endpoint, options = {}) => {
  // Try to get token from localStorage first
  
  
  // If no token in localStorage, try to get from current session
 
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
  
  
  if (!token) {
    console.error('No authentication token found');
    throw new Error('No authentication token found');
  }

  const defaultHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${endpoint}`, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers
    }
  });

  if (!response.ok) {
    try {
      const errorData = await response.json();
      throw new Error(errorData.error || 'An error occurred');
    } catch (e) {
      throw new Error('An error occurred while processing the request');
    }
  }

  return response.json();
};