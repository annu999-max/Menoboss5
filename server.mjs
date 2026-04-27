


import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { URLSearchParams } from 'node:url';

const root = resolve('/Users/asharma/Desktop/Menoboss');
const port = Number(process.env.PORT || 4321);

async function loadDotEnv() {
  try {
    const envText = await readFile(join(root, '.env'), 'utf8');
    envText.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const eq = trimmed.indexOf('=');
      if (eq === -1) return;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (key && !process.env[key]) {
        process.env[key] = value;
      }
    });
  } catch {
    // No local .env file yet.
  }
}

await loadDotEnv();

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

async function handleGenerateReport(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS'
    });
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  if (!process.env.ANTHROPIC_KEY) {
    sendJson(res, 500, { error: 'ANTHROPIC_KEY is not configured on this machine.' });
    return;
  }

  try {
    const { prompt } = JSON.parse(await readBody(req) || '{}');
    if (!prompt || typeof prompt !== 'string') {
      sendJson(res, 400, { error: 'Missing prompt.' });
      return;
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 8000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    if (!response.ok) {
      sendJson(res, response.status, {
        error: data.error && data.error.message ? data.error.message : 'Anthropic request failed.'
      });
      return;
    }

    const text = Array.isArray(data.content)
      ? data.content.filter((block) => block.type === 'text').map((block) => block.text).join('')
      : '';

    if (!text) {
      sendJson(res, 502, { error: 'Model returned no report text.' });
      return;
    }

    sendJson(res, 200, { text });
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
}

async function stripeRequest(path, params, method = 'POST') {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not configured on this machine.');
  }

  const response = await fetch(`https://api.stripe.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json'
    },
    body: params ? new URLSearchParams(params).toString() : undefined
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error && data.error.message ? data.error.message : 'Stripe request failed.');
  }
  return data;
}

async function handleCreateCheckoutSession(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS'
    });
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  try {
    const { email, name, successUrl, cancelUrl } = JSON.parse(await readBody(req) || '{}');
    if (!email || !successUrl || !cancelUrl) {
      sendJson(res, 400, { error: 'Missing checkout details.' });
      return;
    }

    const session = await stripeRequest('/v1/checkout/sessions', {
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: email,
      'line_items[0][quantity]': '1',
      'line_items[0][price_data][currency]': 'nzd',
      'line_items[0][price_data][unit_amount]': '1499',
      'line_items[0][price_data][product_data][name]': 'MenoBoss Individually Tailored Health Report',
      ...(name ? { 'metadata[client_name]': name } : {}),
      'metadata[client_email]': email
    });

    sendJson(res, 200, { url: session.url, sessionId: session.id });
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
}

async function handleVerifyPayment(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS'
    });
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  try {
    const { sessionId } = JSON.parse(await readBody(req) || '{}');
    if (!sessionId || typeof sessionId !== 'string') {
      sendJson(res, 400, { error: 'Missing sessionId.' });
      return;
    }

    const session = await stripeRequest(`/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, null, 'GET');
    const paid = session.payment_status === 'paid' && session.status === 'complete';

    sendJson(res, 200, {
      paid,
      paymentStatus: session.payment_status,
      status: session.status,
      sessionId: session.id
    });
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  if (url.pathname === '/api/generate-report') {
    await handleGenerateReport(req, res);
    return;
  }

  if (url.pathname === '/api/create-checkout-session') {
    await handleCreateCheckoutSession(req, res);
    return;
  }

  if (url.pathname === '/api/verify-payment') {
    await handleVerifyPayment(req, res);
    return;
  }

  const relativePath = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\/+/, '');
  const filePath = join(root, relativePath);

  try {
    const file = await readFile(filePath);
    res.writeHead(200, {
      'Content-Type': mimeTypes[extname(filePath)] || 'application/octet-stream'
    });
    res.end(file);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
});

server.listen(port, () => {
  console.log(`MenoBoss local server running at http://127.0.0.1:${port}`);
});
