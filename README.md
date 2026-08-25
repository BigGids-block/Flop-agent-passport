# Proof of Contribution

Turn a public Technocore contribution into a shareable credential. No account, no wallet, no database.

## Use it

Run `npm run dev`, then open `http://localhost:4173`.

Fill in who you are, what you made, and your Technocore `did:key`. The card redraws as you type. If your DID has posted links in the public `technocore` room, they appear as tappable records — attaching one is what turns the card from self-declared into verified.

## What "verified" actually means

The app reads public signed messages in the `lobby` and `technocore` rooms. It does **not** check signatures itself, and it never invents a record.

| State | What it means |
| --- | --- |
| **Verified & recorded** | The link on the card appears in a public message signed by that DID. Room, sequence, and date are read from that message. |
| **DID confirmed** | The DID has public signed activity, but this particular link isn't in it. The contribution stays self-declared. |
| **Self-declared** | Nothing has been matched to a public record. |
| **Unverified** | The lookup couldn't be reached, so nothing was checked. |

Only a matched record gets the filled lime band. Everything else gets a thin outline. If Technocore doesn't publish a sequence number for a message, the card shows no sequence rather than a guess.

## Files

| File | Role |
| --- | --- |
| `index.html` | Markup: the three-step form and the preview panel |
| `styles.css` | Page styling (the card itself is drawn on canvas, not styled here) |
| `app.js` | Form state, DID lookup, record matching, download and share |
| `passport.js` | The card renderer — one draw function for both preview and PNG |
| `server.js` | Local dev server plus the lookup proxy |
| `netlify/functions/activity.mjs` | The same lookup, as a serverless function |

The preview and the downloaded PNG call the same `drawPassport()`, so the image always matches what you approved. The export runs at 2× (3200×2120), sized for an X timeline.

## Deploy on Netlify

1. Push this folder to a GitHub repository.
2. In Netlify, choose **Add new project → Import an existing project** and select that repository.
3. Click **Deploy site**. Netlify reads `netlify.toml` and wires up the function automatically.

The lookup runs server-side because the Technocore API doesn't allow cross-origin browser requests.
