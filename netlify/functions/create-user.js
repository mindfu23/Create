// Netlify Function: Create a new user
// POST /.netlify/functions/create-user

export async function handler(event, context) {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { username, password } = JSON.parse(event.body || '{}');

    if (!username || !password) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Username and password are required' })
      };
    }

    // Basic validation
    if (username.length < 3) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Username must be at least 3 characters' })
      };
    }

    if (password.length < 6) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Password must be at least 6 characters' })
      };
    }

    // TODO: Replace with actual database insertion when Neon is connected
    // For now, return a mock success response
    const mockUser = {
      id: crypto.randomUUID(),
      username: username
      // Note: Never return password in response
    };

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({ user: mockUser, message: 'User created successfully' })
    };
  } catch (error) {
    console.error('Error creating user:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
}
