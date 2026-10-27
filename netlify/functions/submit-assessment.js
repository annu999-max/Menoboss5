const ADMIN_EMAIL = 'hello@menobossglobal.com';
const FROM_EMAIL = process.env.MENOBOSS_FROM_EMAIL || 'MenoBoss Global <hello@menobossglobal.com>';

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function sendWithResend({ to, subject, html, replyTo }) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [to],
      subject,
      html,
      reply_to: replyTo || ADMIN_EMAIL
    })
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Resend rejected the email: ${body.slice(0, 300)}`);
  }
}

async function submitToFormSubmit(payload) {
  const form = new URLSearchParams();
  form.append('_to', ADMIN_EMAIL);
  form.append('_subject', payload.subject || `New MenoBoss Client - ${payload.clientName}`);
  form.append('_captcha', 'false');
  form.append('_template', 'table');
  form.append('email', payload.clientEmail);
  form.append(
    '_autoresponse',
    'Thank you for completing your MenoBoss assessment. We have received your payment and symptom profile. Our team will prepare your individually tailored report and email it to you within 36 hours. With warmth, MenoBoss Global.'
  );
  form.append('Date', payload.date || 'N/A');
  form.append('Client Name', payload.clientName || 'N/A');
  form.append('Client Email', payload.clientEmail || 'N/A');
  form.append('Age', payload.age || 'N/A');
  form.append('Height', payload.height || 'N/A');
  form.append('Weight', payload.weight || 'N/A');
  form.append('BMI', payload.bmi || 'N/A');
  form.append('Total Score', payload.totalScore || 'N/A');
  form.append('Symptoms Present', payload.symptomsPresent || 'N/A');
  form.append('Severity', payload.severity || 'N/A');
  form.append('Category Scores', payload.categoryScores || 'N/A');
  form.append('Top Symptoms', payload.topSymptoms || 'N/A');
  form.append('Coach Add-on', payload.coachAddOn || 'No');
  form.append('Delivery Promise', payload.deliveryPromise || 'Detailed report to be emailed within 36 hours after expert review');
  form.append('Action', payload.action || 'Prepare the report and email the client within 36 hours.');

  const response = await fetch(`https://formsubmit.co/${ADMIN_EMAIL}`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: form.toString()
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`FormSubmit rejected the submission: ${text.slice(0, 300)}`);
  }
}

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

  try {
    const payload = JSON.parse(event.body || '{}');
    const required = ['clientName', 'clientEmail', 'totalScore', 'symptomsPresent'];
    const missing = required.filter((key) => !payload[key]);

    if (missing.length) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: `Missing fields: ${missing.join(', ')}` })
      };
    }

    const displayName = escapeHtml(payload.clientName.split(' ')[0] || 'there');
    const clientEmailHtml = `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#263238;line-height:1.6">
        <h1 style="color:#3AAFB1;font-size:28px;font-weight:600">Thank you, ${displayName}</h1>
        <p>We have received your MenoBoss assessment and payment.</p>
        <p>Our team will now review your symptom profile and prepare your individually tailored report. It will be emailed to you within <strong>36 hours</strong>.</p>
        <p>${payload.coachAddOn && payload.coachAddOn !== 'No' ? 'We have also noted your coach-session add-on and will be in touch with the next steps.' : 'We look forward to supporting you through your next chapter.'}</p>
        <p style="margin-top:28px">With warmth,<br><strong>MenoBoss Global</strong></p>
      </div>`;

    if (process.env.RESEND_API_KEY) {
      await Promise.all([
        sendWithResend({
          to: ADMIN_EMAIL,
          subject: payload.subject || `New MenoBoss Client - ${payload.clientName}`,
          html: `<pre style="font-family:Arial,sans-serif;white-space:pre-wrap">${escapeHtml(JSON.stringify(payload, null, 2))}</pre>`,
          replyTo: payload.clientEmail
        }),
        sendWithResend({
          to: payload.clientEmail,
          subject: 'Thank you for your MenoBoss assessment',
          html: clientEmailHtml
        })
      ]);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ ok: true, clientConfirmationSent: true, delivery: 'resend' })
      };
    }

    await submitToFormSubmit(payload);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        clientConfirmationSent: true,
        delivery: 'formsubmit',
        warning: 'FormSubmit delivery accepted.'
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
