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

    const form = new URLSearchParams();
    form.append('_to', 'info@menobossglobal.com');
    form.append('_subject', payload.subject || `New MenoBoss Client - ${payload.clientName}`);
    form.append('_captcha', 'false');
    form.append('_template', 'table');
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

    const response = await fetch('https://formsubmit.co/info@menobossglobal.com', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: form.toString()
    });

    const text = await response.text();

    if (!response.ok) {
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({
          error: 'FormSubmit rejected the submission.',
          detail: text.slice(0, 500)
        })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};
