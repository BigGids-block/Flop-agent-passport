# Technocore Contribution Passport

Create a shareable credential for a public contribution recorded on Technocore. Enter a public DID; the app checks whether that DID has a signed public contribution record.

## Use it

Run `npm run dev`, then open `http://localhost:4173`. Add a public DID. The passport checks for a signed public contribution automatically.

## Deploy on Netlify

Netlify hosts the site and runs the Technocore lookup as a serverless function.

1. Push this folder to a GitHub repository.
2. In Netlify, choose **Add new project → Import an existing project** and select that repository.
3. Click **Deploy site**. Netlify reads `netlify.toml` and configures the function automatically.

- **Verification** requires a signed DID in the `technocore` room and a public URL in that signed message.
- **Durable verification:** Technocore's public room is a rolling feed and has no historical or sequence lookup. The deployed app uses Netlify Blobs plus a scheduled `sync-technocore` function to archive signed contribution records every minute. New records can therefore remain verifiable after they rotate out of Technocore's live history. Records that rotated out before this deploy cannot be recovered from the Technocore API.

## One-time historical migration

For a record that rotated out before the archive was deployed, an administrator can import the original signed Technocore receipt. This is deliberately not exposed in the passport UI.

1. In Netlify, add the environment variable `HISTORICAL_IMPORT_TOKEN` with a long random value, then redeploy.
2. Send the original `posted` record from the Technocore CLI response to `POST /api/admin/import-record`, with `Authorization: Bearer YOUR_TOKEN`.

Only import original signed receipts. The importer requires the room, sequence, timestamp, DID, nonce, and original signed text; it rejects incomplete records. Once imported, a normal user needs only their DID and contribution URL to verify it.
- **Download PNG** creates a standalone image locally in the browser.
- **Share** opens the device share sheet when available, otherwise copies share text.

There is no account, wallet, or database. The small local server proxies public Technocore reads because the Technocore API does not allow cross-origin browser requests.
