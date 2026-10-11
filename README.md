# AMR Universal LTD — Website & WhatsApp Live Desk

A complete trading-house website with a live offers board managed entirely
from WhatsApp. Node.js 20 + Express + SQLite, one service, no client-side
frameworks, no tracking.

- **Website** — Home, The House, Paper & Board, Metals, Live Desk, The Ledger,
  Terms of Trade, Contact, plus Privacy and Terms of Use.
- **Live Desk** — the owner posts, edits and closes lots from WhatsApp; the
  site updates within 45 seconds, no redeploys.
- **Lead capture** — every enquiry and every "Request full details" event is
  pushed to the owner's WhatsApp instantly, with failed sends queued and
  retried.

The site runs fully **without** the WhatsApp variables (seed lots, forms and
all pages work) — so you can deploy today and wire Meta afterwards.

---

## 1. Run it locally (optional)

```bash
npm install
npm run build   # generates the company-profile PDF
npm start       # http://localhost:3000
```

On first boot the desk seeds itself with sample lots. Data lives in `./data/`.

## 2. Build a static website

```bash
BASE_URL=https://your-domain.example npm run build:static
```

The complete public site is written to `dist/`, including the home page,
service and legal pages, each Ledger note, the 404 page, SEO files, assets and
the company-profile PDF. Publish the contents of `dist/` with any static web
host. Set `BASE_URL` to the final origin when building so canonical links and
the sitemap use the correct domain.

The Live Desk is a snapshot of the database at build time and changes only
after rebuilding. Static forms open the visitor's email client, and lot-detail
requests open WhatsApp; server-only features such as lead capture, live updates,
administration and the WhatsApp webhook require the Node.js service.

---

## 3. Deploy on Render — exact clicks

1. Push this folder to a GitHub repository (private is fine).
2. Go to **dashboard.render.com → New → Blueprint**.
3. Connect your GitHub account if asked, pick the repository, click **Connect**.
4. Render reads `render.yaml` and shows the service `amr-universal`. It will
   prompt for the environment variables marked `sync: false`:
   - `BASE_URL` — leave blank for now (set it in step 6).
   - The five WhatsApp variables — leave blank for now if you have not done
     the Meta setup yet. The site runs without them.
5. Click **Apply**. The first build takes a few minutes.
6. When it is live, copy the URL Render gives you
   (`https://amr-universal-XXXX.onrender.com`), then open the service →
   **Environment** → set `BASE_URL` to exactly that URL (no trailing slash)
   → **Save changes**. The service redeploys; done.

`BASE_URL` drives every absolute link (sitemap, canonical tags, WhatsApp
confirmations). It is never hard-coded, so the later custom-domain switch is
one variable change — see section 6.

### Keeping the free instance awake

Free Render services sleep after ~15 minutes of inactivity and take ~50
seconds to wake. That delays webhook replies and enquiry pushes badly.

- Short term: create a free monitor at **uptimerobot.com** → New Monitor →
  HTTP(s) → URL `https://<your-service>.onrender.com/health` → interval
  5 minutes. This keeps the instance warm most of the time.
- Properly: switch to the **Starter instance ($7/month)** once trading
  starts. It never sleeps, and it supports the **persistent disk** —
  on the free plan SQLite is ephemeral, so lots posted via WhatsApp are lost
  on each deploy or restart. Starter + disk makes them durable. To switch:
  service → **Settings → Instance Type → Starter**, then uncomment the
  `disk:` block and the `DATA_DIR` variable in `render.yaml` and push.

---

## 4. What runs where

| Path | Purpose |
| --- | --- |
| `/` … `/contact` | The website (server-rendered EJS) |
| `/live-desk` | The two boards; polls `/api/offers` + `/api/wanted` every 45 s |
| `/api/reveal` | "Request full details" — captures the lead, reveals the lot |
| `/api/enquiry`, `/api/subscribe` | Contact form and the Wire signup |
| `/admin/subscribers.csv?token=…` | Subscriber export (`ADMIN_TOKEN`) |
| `/admin/leads.csv?token=…` | Lead export (`ADMIN_TOKEN`) |
| `/whatsapp/webhook` | Meta webhook (GET verification, POST messages) |
| `/health` | Uptime endpoint |

---

## 5. WhatsApp Business Cloud API — full setup

Written for a smart non-developer. Allow 45 minutes. You need: a Facebook
account, and the phone number the desk will use (it must NOT already be
registered on the WhatsApp consumer or Business app — Meta takes it over).

### 5.1 Create the Meta developer app

1. Go to **developers.facebook.com** → log in → **My Apps → Create App**.
2. Choose **Business** as the app type → Next.
3. Name it (e.g. "AMR Desk"), enter your email, click **Create App**.
4. If asked for a Business Portfolio, create one ("AMR Universal Ltd").

### 5.2 Add the WhatsApp product

1. On the app dashboard, find **WhatsApp** → click **Set up**.
2. Meta gives you a **test phone number** immediately. You can wire the whole
   system to the test number first, then register the real number later.
3. Open **WhatsApp → API Setup**. Note two values on this page:
   - **Phone number ID** (a long number — this is `WHATSAPP_PHONE_NUMBER_ID`;
     it is *not* the phone number itself)
   - The temporary access token (ignore it — it dies in 24 h; the permanent
     one comes next).

### 5.3 Permanent access token via a System User

1. Go to **business.facebook.com → Settings** (gear icon) → **Users →
   System users** → **Add**.
2. Name: "amr-webhook", role: **Admin** → Create.
3. Click the new system user → **Add assets** → **Apps** → select your app →
   toggle **Manage app** → Save.
4. Click **Generate new token** → select your app → token expiration:
   **Never** → permissions: tick **whatsapp_business_messaging** and
   **whatsapp_business_management** → Generate.
5. Copy the token somewhere safe. This is `WHATSAPP_ACCESS_TOKEN`.

### 5.4 App secret

**developers.facebook.com → your app → App settings → Basic → App secret →
Show**. This is `META_APP_SECRET` (used to verify that webhook calls really
come from Meta).

### 5.5 Register the real business number

1. **WhatsApp → API Setup → Add phone number** (in the "From" dropdown).
2. Enter the business display name, category, and the phone number; verify
   it by SMS or voice call.
3. The new number gets its own **Phone number ID** — use that as
   `WHATSAPP_PHONE_NUMBER_ID`.
4. Business verification (Business Settings → Security Centre) lifts the
   messaging limits; start it early, it can take a few days.

### 5.6 Set the environment variables on Render

Service → **Environment** → add:

| Variable | Value |
| --- | --- |
| `META_APP_SECRET` | from 4.4 |
| `WHATSAPP_VERIFY_TOKEN` | any string you invent, e.g. `amr-verify-9271` |
| `WHATSAPP_ACCESS_TOKEN` | from 4.3 |
| `WHATSAPP_PHONE_NUMBER_ID` | from 4.2 / 4.5 |
| `ADMIN_WHATSAPP_NUMBERS` | Nishant's personal WhatsApp number(s), digits only with country code, comma-separated — e.g. `447700900123` |

Save; the service redeploys.

### 5.7 Point the webhook at the site

1. **developers.facebook.com → your app → WhatsApp → Configuration**.
2. **Webhook → Edit**:
   - Callback URL: `https://<your-service>.onrender.com/whatsapp/webhook`
   - Verify token: the exact `WHATSAPP_VERIFY_TOKEN` string you set above.
   - Click **Verify and save**. (If it fails, the service is asleep — open
     `/health` in a browser first, or check the token matches.)
3. Still on that page: **Webhook fields → Manage** → subscribe to
   **messages**. Nothing else is needed.

### 5.8 Test

From Nishant's phone, WhatsApp the business number: `HELP`. The cheat sheet
should come back within seconds. Then post a first lot (see
`OWNERS-MANUAL.md`). A message from any non-admin number gets one polite
refusal and is then ignored.

---

## 6. The custom-domain switch (later)

1. Buy the domain; in Render: service → **Settings → Custom Domains → Add**,
   follow the DNS instructions.
2. Change `BASE_URL` to `https://www.yourdomain.com` → Save.
3. Update the webhook Callback URL (step 5.7) to the new domain.

Done. Nothing else references the old URL.

### Email, when the domain exists

Set up professional mailboxes (Google Workspace, Microsoft 365, or Zoho) on
the domain with **SPF, DKIM and DMARC** records configured — the provider's
wizard handles all three. Then update the address in
`src/company-config.js`. **Never send trade correspondence from a gmail
address** — buyers' compliance departments notice, and deliverability of LC
and shipping documents matters.

---

## 7. Content & configuration

- **Company particulars** (footer, legal pages, PDF): `src/company-config.js`.
  Drop in the company number and registered office after incorporation.
- **Accreditations**: same file — set `held: true` and fill `detail` when a
  licence/certificate is actually granted. Until then the site shows
  "accreditation in progress" and claims nothing.
- **Ledger notes**: add markdown files to `content/ledger/` named
  `YYYY-MM-DD-slug.md` with `title` / `date` / `summary` frontmatter. They
  appear automatically and join the sitemap. This is the SEO engine — one
  short note a month is enough.
- **Terms of Trade** (`src/views/terms.ejs`): standard commercial boilerplate,
  clearly labelled indicative. **Have a solicitor review it before heavy
  use** — particularly the franchise, claims and jurisdiction clauses.
- **Photography**: the design currently uses no photography. When you have
  real images (paper reels, ports, billets — desaturated, no stock
  handshakes), add them under `public/img/` and reference from the views.
- **Fonts**: system stacks only (fast, and no third-party requests, which is
  what lets the privacy page boast). If you later license Canela or buy
  Cormorant Garamond files, self-host the woff2 in `public/fonts/` and add
  one `@font-face` block to `public/css/style.css` — do not use Google Fonts
  hosting, it would undermine the no-third-party claim.

## 8. Data & backups

- SQLite database: `DATA_DIR/amr.sqlite` (lots, leads, subscribers,
  notification queue). Lot photos: `DATA_DIR/media/`.
- WhatsApp `BACKUP` command returns the database file as a document;
  the same runs automatically every Sunday.
- Weekly routine: download `/admin/subscribers.csv?token=…` and
  `/admin/leads.csv?token=…` (the `ADMIN_TOKEN` is auto-generated by Render —
  read it from the Environment tab).
