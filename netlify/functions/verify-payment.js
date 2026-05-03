exports.handler = async function (event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'STRIPE_SECRET_KEY is not configured.' })
    };
  }

  try {
    const { sessionId } = JSON.parse(event.body || '{}');

    if (!sessionId || typeof sessionId !== 'string') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing sessionId.' })
      };
    }

    const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
        Accept: 'application/json'
      }
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({
          error: data.error && data.error.message ? data.error.message : 'Stripe request failed.'
        })
      };
    }

    const paid = data.payment_status === 'paid' && data.status === 'complete';

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        paid,
        paymentStatus: data.payment_status,
        status: data.status,
        sessionId: data.id
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};
