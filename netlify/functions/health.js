// Netlify Function: Health check / API status
// GET /.netlify/functions/health

export async function handler(event, context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      status: 'ok',
      timestamp: new Date().toISOString(),
      message: 'Create! API is running'
    })
  };
}
