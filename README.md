# Technocore Contribution Passport

Create a shareable credential for a public contribution recorded on Technocore. Enter a public DID and contribution URL; the app verifies that they match a signed Technocore record.

## Use it

Run `npm run dev`, then open `http://localhost:4173`. Add the public DID and the same contribution URL that was announced in Technocore. The passport checks for a matching signed record automatically.

## Deploy on Netlify

Netlify hosts the site and runs the Technocore lookup as a serverless function.

1. Push this folder to a GitHub repository.
2. In Netlify, choose **Add new project → Import an existing project** and select that repository.
3. Click **Deploy site**. Netlify reads `netlify.toml` and configures the function automatically.

- **Verification** requires a matching signed DID and exact public contribution URL in the `technocore` room.
- **Record archive:** Technocore rooms are rolling feeds, so durable historical records are kept in `lib/verified-records.mjs`. Add each newly confirmed signed record there after publishing it. The app also checks the current public room for recent records.
- **Download PNG** creates a standalone image locally in the browser.
- **Share** opens the device share sheet when available, otherwise copies share text.

There is no account, wallet, or database. The small local server proxies public Technocore reads because the Technocore API does not allow cross-origin browser requests.
