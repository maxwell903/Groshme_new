// utils/fetch.js
export const fetchWithAuth = async (endpoint, options = {}) => {
  const token = localStorage.getItem('access_token');
  
  if (!token) {
    console.error('No authentication token found');
    throw new Error('No authentication token found');
  }

  console.log('Making authenticated request with token:', token.substring(0, 20) + '...');

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

  // Log the response status
  console.log(`Response status: ${response.status}`);

  if (!response.ok) {
    try {
      const errorData = await response.json();
      console.error('Error response:', errorData);
      throw new Error(errorData.error || 'An error occurred');
    } catch (e) {
      console.error('Error parsing error response:', e);
      throw new Error('An error occurred while processing the request');
    }
  }

  const data = await response.json();
  console.log('Response data:', data);
  return data;
};