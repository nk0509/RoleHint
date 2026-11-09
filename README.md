# RoleHint

A public website that audits any CV against a target role, with a fit score, gaps, bullet rewrites, market roles and pivot roles, and writes a cover letter for the job. RoleHint was called Roleproof until November 2026. To rename it, find and replace the name across `public/`, and change the logo, which every page header writes as `<span>Role</span>hint`.

## How it fits together

- `public/` is the website. `index.html` is the front page. `home.js` runs its upload button, and `tricks.js` runs its playful parts: the changing word, the button that runs away, the x-ray CV, the feedback switch and the tab title. `fx.js` runs the moving smoke and the blur-in on scroll. `audit.html` is the CV tool (at `/audit`), and `app.js` runs it. `cover-letter.html` is the letter tool, and `letter.js` runs it. `certifications.html` tells people if a certificate is worth it for a job, and `certs.js` runs it. `read-cv.js` reads CV files and `api-client.js` calls the server for these pages. `mechanics.html` explains the product, `contact.html` asks people to email you, and `privacy.html` and `terms.html` are the legal pages. These last three show your email address, so change it in all of them. `styles.css` holds the theme and all styling. To recolour the site, change `--pop` at the top, which also recolours the smoke, then change the same colour in `favicon.svg`.
- The header and footer are written out in each HTML page, so change them on every page.
- `public/brand/` holds the logo files. `share.png` is the preview image shown when someone shares a link, and `apple-touch-icon.png` is the icon phones use. Every page points to the preview image by its full address, so after you connect a new domain, replace `rolehint.vercel.app` with it in each page's `og:image` line. The site also answers at `roleproof-lemon.vercel.app`, its first address.
- `api/` holds the server functions. `audit.js` runs an audit, `cover-letter.js` writes a letter, `certifications.js` makes a certificate plan, `chat.js` answers follow-ups, and `config.js` tells the page its settings.
- `lib/` holds shared server code. `gemini.js` connects to Google's Gemini API. Edit the audit, cover letter and certificate instructions in `lib/prompts.js`.
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
7. **Settings:** in Vercel under Settings, then Environment Variables, add `GEMINI_API_KEY`. The limit numbers from `.env.example` are optional, and the same values are used if you leave them out. Redeploy after any change here.
8. **Bot check (recommended):** create a free Cloudflare Turnstile widget and add `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`. It then guards CV checks, follow-up questions, cover letters and certificate checks.
9. **Legal pages:** read `public/privacy.html` and `public/terms.html`, and have them reviewed.
10. **Domain:** buy your domain and add it in Vercel under Settings, then Domains.
11. **Final check:** run a full audit on the live site, on a phone too, and check that the limit message appears.

## Measuring quality

`eval/` checks how good the CV check really is. It runs the same code as the live site on test cases with known answers, compares it with a plain AI prompt, and writes a shareable report. Run `npm run eval -- --mock` for a free practice run, or `npm run eval -- --baseline` for the real thing, which asks before spending credit. See `eval/README.md` for what it measures and how to add cases.

## Keeping the certificate list current

`lib/certifications.js` is a hand-checked list. The AI can only recommend certificates from it, and the cost, validity and links people see come from that file. About every three months, open each official link, fix anything that changed, move any closed certificate to `RETIRED`, and set `CHECKED` to the current month. The page shows that date to visitors.

## Controlling cost

`AUDITS_PER_DAY_TOTAL`, `LETTERS_PER_DAY_TOTAL`, `CERT_CHECKS_PER_DAY_TOTAL` and `CHATS_PER_DAY_TOTAL` cap daily use across all visitors. Unless you set them, the site allows 15 CV checks, 15 cover letters, 15 certificate checks and 50 follow-up questions a day, which keeps a worst day's AI bill to roughly ₹60 at late-2026 prices. Raise them when you have more credit. The counts reset at midnight UTC, which is 5:30 am in India. Set `GEMINI_MODEL=gemini-3.1-flash-lite` in Vercel to run on a cheaper model, and compare report quality before you keep it.

Vercel's time limit for each request depends on your plan. `vercel.json` asks for up to 300 seconds.

## If Google refuses requests

- **`402` "Your prepayment credits are depleted":** the key works, but its project has no usable credit. Credit sits on a billing account, so open https://ai.studio/projects and check that the key's project is linked to the billing account holding your balance.
- **`401` `ACCESS_TOKEN_TYPE_UNSUPPORTED`:** Google isn't accepting the key. Create a new key in a project imported into AI Studio.

`npm run dev` always uses the key in `.env.local`. A `GEMINI_API_KEY` saved in your Windows environment variables is ignored here, but other tools on your computer may still read it.
