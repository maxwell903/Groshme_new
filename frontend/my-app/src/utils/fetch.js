export const fetchWithAuth = async (endpoint, options = {}) => {
  const maxRetries = 10;
  let attempts = 0;

  while (attempts < maxRetries) {
    try {
      // Try to get token from localStorage first
      let token = localStorage.getItem('access_token');
      
      // If no token in localStorage, try to get from current session
      if (!token) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          token = session.access_token;
          localStorage.setItem('access_token', token);
        }
      }
      
      if (!token) {
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
        // If unauthorized, clear token and retry
        if (response.status === 401) {
          localStorage.removeItem('access_token');
          attempts++;
          continue;
        }
        throw new Error('Request failed');
      }

      return response.json();
    } catch (error) {
      if (attempts === maxRetries - 1) throw error;
      attempts++;
    }
  }
};