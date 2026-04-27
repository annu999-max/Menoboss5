## Deploy

Recommended host: Netlify

1. Upload the project folder contents from `/Users/asharma/Desktop/Menoboss`
2. Set environment variables in Netlify:
   - `ANTHROPIC_KEY`
   - `STRIPE_SECRET_KEY`
3. Publish the site

The app expects:
- `index.html` at the site root
- `/.netlify/functions/generate-report` via `netlify.toml`

## Embed

Use an iframe on your website:

```html
<iframe
  src="https://your-app-domain.example/"
  title="MenoBoss Assessment"
  width="100%"
  height="1600"
  style="border:0;overflow:hidden"
  loading="lazy"
  allow="payment *"
></iframe>
```

Notes:
- Stripe checkout opens in a new tab when the app is embedded.
- After payment, the customer returns to the hosted app URL to verify payment and generate the report.
- If your site builder supports custom embed height, give it generous height or allow scrolling.
