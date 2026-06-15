# Booking backend setup (Google Calendar + automated emails)

This connects the **Book a free 20-min consult** flow to real services:

- **Google Calendar** — each booking creates an event on your calendar with a
  Google Meet link, and sends the visitor a calendar invite.
- **Resend** — sends the visitor a branded confirmation email.

The site stays a normal static site; bookings are handled by one serverless
function at [`api/book.js`](api/book.js). All secrets live in environment
variables, never in the browser.

---

## 0. Prerequisites

```powershell
npm install              # installs googleapis + resend
npm install -g vercel    # the host/CLI we'll use (free tier is plenty)
```

---

## 1. Resend (confirmation emails)

1. Sign up at <https://resend.com>.
2. **Add & verify your domain** (Settings → Domains). This lets you send from
   `hello@yourdomain.com`. *(For quick testing you can use Resend's
   `onboarding@resend.dev` sender instead.)*
3. Create an API key at <https://resend.com/api-keys> → copy it.
4. In [`api/book.js`](api/book.js), set `CONFIG.fromEmail` to your verified address.

---

## 2. Google Calendar (service account)

A **service account** is a robot Google identity your server uses — no login
popups, works unattended.

1. Go to <https://console.cloud.google.com> → create a project.
2. **APIs & Services → Library →** search **Google Calendar API → Enable**.
3. **APIs & Services → Credentials → Create credentials → Service account.**
   Give it a name, create it (no roles needed).
4. Open the service account → **Keys → Add key → Create new key → JSON.**
   A `.json` file downloads. Inside it you'll find `client_email` and
   `private_key` — you need both.
5. **Share your calendar with the robot:** open Google Calendar →
   *Settings → your calendar → Share with specific people →* add the
   `client_email` from the JSON → permission **"Make changes to events."**
   - Leaving `CONFIG.calendarId = 'primary'` writes to that shared calendar.

---

## 3. Environment variables

Copy the example file and fill in your values:

```powershell
Copy-Item .env.example .env.local
```

Then edit `.env.local`:

- `RESEND_API_KEY` — from step 1.
- `GOOGLE_CLIENT_EMAIL` — the `client_email` from the JSON.
- `GOOGLE_PRIVATE_KEY` — the `private_key` from the JSON, **on one line with the
  `\n` escapes kept** (wrap it in double quotes, exactly as `.env.example` shows).

> `.env.local` is gitignored. Never commit it.

---

## 4. Run locally

```powershell
vercel dev
```

Open the local URL it prints, click **Book a free 20-min consult**, pick a slot,
and confirm. You should get a real calendar event + email. If keys are missing,
the site falls back to the demo message — nothing breaks.

---

## 5. Deploy

```powershell
vercel            # first time: links/creates the project
vercel --prod     # deploy to production
```

Then add the same three variables in the Vercel dashboard:
**Project → Settings → Environment Variables** (paste the private key with its
`\n` escapes). Redeploy and you're live.

---

## Where to edit things

| You want to change…            | Edit this |
|--------------------------------|-----------|
| Email wording / subject        | `buildEmail()` in [`api/book.js`](api/book.js) |
| Consult length, brand, calendar| `CONFIG` in [`api/book.js`](api/book.js) |
| Available days / times         | `buildDates()` / `buildTimes()` in [`script.js`](script.js) |
| Sender address                 | `CONFIG.fromEmail` in [`api/book.js`](api/book.js) |

## Troubleshooting

- **403 / "insufficient permissions"** — you didn't share the calendar with the
  service-account email, or used the wrong `calendarId`.
- **Email not arriving** — domain not verified in Resend, or `fromEmail` isn't on
  a verified domain. Check spam; check the Resend dashboard logs.
- **Wrong time on the event** — the browser sends the visitor's timezone; the
  event is created in that zone. That's usually what you want for a video call.
