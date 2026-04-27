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
    const { email, name, successUrl, cancelUrl } = JSON.parse(event.body || '{}');

    if (!email || !successUrl || !cancelUrl) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing checkout details.' })
      };
    }

    const params = new URLSearchParams({
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: email,
      'line_items[0][quantity]': '1',
      'line_items[0][price_data][currency]': 'nzd',
      'line_items[0][price_data][unit_amount]': '1499',
      'line_items[0][price_data][product_data][name]': 'MenoBoss Individually Tailored Health Report',
      'metadata[client_email]': email
    });

    if (name) {
      params.append('metadata[client_name]', name);
    }

    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json'
      },
      body: params.toString()
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

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ url: data.url, sessionId: data.id })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};
