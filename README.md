# Roleproof

A public website that audits any CV against a target role: fit score, gaps, bullet rewrites, market roles and pivot roles. Roleproof is a working name. To change it, find and replace it in `public/`.

## How it fits together

- `public/` is the website. `index.html` is the front page, `audit.html` is the CV tool (at `/audit`), `app.js` runs the tool, `styles.css` holds the theme and all styling, and `privacy.html` and `terms.html` are the legal pages.
- `api/` holds the server functions. `audit.js` runs an audit, `chat.js` answers follow-ups, and `config.js` tells the page its settings.
- `lib/` holds shared server code. `gemini.js` connects to Google's Gemini API. Edit the audit instructions in `lib/prompts.js`.
- Your API key stays on the server. Never put it in `public/`.

## Try it on your computer

You need Node.js 22.9 or newer.

```bash
npm install
```

To see the site with a canned report, without an API key:

```bash
npm run mock
```

To use real AI, copy your key from https://aistudio.google.com/api-keys, then save it to `.env.local` from your clipboard:

```bash
npm run setkey
```

Then start the site:

```bash
npm run dev
```

Open http://localhost:3000. Run the automated checks with `npm test`. They don't use any credit.

If `public/vendor` is ever missing, run `npm run vendor` to restore the PDF and Word readers.

## Launch checklist

1. **Gemini key:** create a key at https://aistudio.google.com in a project with billing on, and make sure the project has credit.
2. **Test with real AI:** run `npm run dev` and audit several made-up CVs. The server logs token counts for each audit, so you can work out the real cost.
3. **Limits:** check your billing tier's rate limits against your daily limits, and consider a spend cap on the project.
4. **GitHub:** create a private repository and push this folder. `.gitignore` keeps `.env.local` out.
5. **Vercel:** sign in with GitHub, click Add New, then Project, and import the repository. Keep the default settings.
6. **Redis:** in Vercel, open the project's Storage tab, create a free Upstash for Redis database and connect it to the project. This adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` for you. The live site refuses all audits until this is connected, which stops a missing limit from costing you money.
7. **Settings:** in Vercel under Settings, then Environment Variables, add `GEMINI_API_KEY`. The four limit numbers from `.env.example` are optional, and the same values are used if you leave them out. Redeploy after any change here.
8. **Bot check (recommended):** create a free Cloudflare Turnstile widget and add `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`.
9. **Legal pages:** replace every [bracketed] item in `public/privacy.html` and `public/terms.html`, remove the draft note, and have them reviewed.
10. **Domain:** buy your domain and add it in Vercel under Settings, then Domains.
11. **Final check:** run a full audit on the live site, on a phone too, and check that the limit message appears.

## Controlling cost

`AUDITS_PER_DAY_TOTAL` and `CHATS_PER_DAY_TOTAL` cap daily use across all visitors. Set `GEMINI_MODEL=gemini-3.1-flash-lite` in Vercel to run on a cheaper model, and compare report quality before you keep it.

Vercel's time limit for each request depends on your plan. `vercel.json` asks for up to 300 seconds.

## If Google refuses requests

- **`402` "Your prepayment credits are depleted":** the key works, but its project has no usable credit. Credit sits on a billing account, so open https://ai.studio/projects and check that the key's project is linked to the billing account holding your balance.
- **`401` `ACCESS_TOKEN_TYPE_UNSUPPORTED`:** Google isn't accepting the key. Create a new key in a project imported into AI Studio.

`npm run dev` always uses the key in `.env.local`. A `GEMINI_API_KEY` saved in your Windows environment variables is ignored here, but other tools on your computer may still read it.
