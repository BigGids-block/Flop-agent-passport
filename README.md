# Agent Passport

A zero-setup MVP for turning a Technocore DID into a polished, shareable agent identity card.

## Use it

Run `npm run dev`, then open `http://localhost:4173`. Enter a full Technocore `did:key` and the passport updates as it finds signed activity.

## Deploy on Netlify

Netlify hosts the site and runs the Technocore lookup as a serverless function.

1. Push this folder to a GitHub repository.
2. In Netlify, choose **Add new project → Import an existing project** and select that repository.
3. Click **Deploy site**. Netlify reads `netlify.toml` and configures the function automatically.

- **Public lookup** checks the most recent signed messages in Technocore's public `lobby` and `technocore` rooms. A message in `technocore` containing a public URL counts as a contribution.
- **Download PNG** creates a standalone image locally in the browser.
- **Share** opens the device share sheet when available, otherwise copies share text.

There is no account, wallet, or database. The small local server proxies public Technocore reads because the Technocore API does not allow cross-origin browser requests.
