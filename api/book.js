// =============================================================================
//  POST /api/book  — Vercel serverless function
//
//  Receives a booking from the website, then:
//    1. Creates an event on YOUR Google Calendar (with a Meet link + invite)
//    2. Sends a confirmation email to the visitor via Resend
//
//  Nothing secret lives in the browser — all keys are read from environment
//  variables (see .env.example and BACKEND_SETUP.md).
//
//  Edit the EMAIL TEMPLATE and CONFIG section below to match your brand.
// =============================================================================

const { google } = require('googleapis');
const { Resend } = require('resend');

// ----------------------------- CONFIG ---------------------------------------
const CONFIG = {
  brand: 'expon3nt',
  // Test sender: works immediately, but Resend only delivers it to the email
  // you signed up with. Switch to 'expon3nt <hello@yourdomain.com>' once you've
  // verified your own domain in Resend.
  fromEmail: 'expon3nt <onboarding@resend.dev>',
  consultMinutes: 20,
  // Which calendar to write to. IMPORTANT: with a service account, 'primary'
  // is the ROBOT's own (invisible) calendar — not yours. Use your personal
  // calendar's ID, which is just your Gmail address, and make sure you've
  // shared that calendar with the service-account email ("Make changes to events").
  calendarId: 'charliehumbert724@gmail.com',
};

// --------------------------- EMAIL TEMPLATE ----------------------------------
// Edit this freely. Available variables: name, dateLabel, timeLabel, meetLink.
function buildEmail({ name, dateLabel, timeLabel, meetLink }) {
  const subject = `Your free ${CONFIG.consultMinutes}-min consult with ${CONFIG.brand} is confirmed ✅`;

  const text = `Hi ${name},

Thanks for booking a free ${CONFIG.consultMinutes}-minute consult with ${CONFIG.brand} — I'm looking forward to it!

  Date:  ${dateLabel}
  Time:  ${timeLabel} (${CONFIG.consultMinutes} minutes)
  Join:  ${meetLink || 'Video link to follow'}

Before we talk, feel free to reply with anything you'd like to focus on
(SEO, social media, your website, or all three).

Talk soon,
${CONFIG.brand}`;

  const html = `
  <div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:auto;color:#1a1a1a;line-height:1.6">
    <h2 style="color:#6c5ce7;margin-bottom:4px">You're booked! 🎉</h2>
    <p>Hi ${escapeHtml(name)},</p>
    <p>Thanks for booking a free ${CONFIG.consultMinutes}-minute consult with <strong>${CONFIG.brand}</strong> — I'm looking forward to it!</p>
    <table style="border-collapse:collapse;margin:16px 0">
      <tr><td style="padding:4px 12px 4px 0">🗓 <strong>Date</strong></td><td>${escapeHtml(dateLabel)}</td></tr>
      <tr><td style="padding:4px 12px 4px 0">🕒 <strong>Time</strong></td><td>${escapeHtml(timeLabel)} (${CONFIG.consultMinutes} min)</td></tr>
      <tr><td style="padding:4px 12px 4px 0">📍 <strong>Join</strong></td><td>${meetLink ? `<a href="${meetLink}">${meetLink}</a>` : 'Video link to follow'}</td></tr>
    </table>
    <p>Before we talk, feel free to reply with anything you'd like to focus on (SEO, social media, your website, or all three).</p>
    <p style="margin-top:24px">Talk soon,<br/><strong>${CONFIG.brand}</strong></p>
  </div>`;

  return { subject, text, html };
}

// ------------------------------ HANDLER --------------------------------------
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ message: 'Method not allowed' });
    return;
  }

  try {
    const { name, email, startISO, timeZone, dateLabel, timeLabel } = req.body || {};

    if (!name || !email || !startISO) {
      res.status(400).json({ message: 'Missing name, email, or time.' });
      return;
    }

    const start = new Date(startISO);
    const end = new Date(start.getTime() + CONFIG.consultMinutes * 60 * 1000);

    // 1) Create the Google Calendar event ------------------------------------
    const calendar = getCalendarClient();
    const event = await calendar.events.insert({
      calendarId: CONFIG.calendarId,
      sendUpdates: 'none',      // can't invite attendees from a service account
                                // on a personal Gmail; the Resend email below
                                // confirms the booking to the visitor instead.
      requestBody: {
        summary: `${CONFIG.brand} consult — ${name}`,
        // Put the visitor's contact in the description since we can't add them
        // as a formal attendee (would require Workspace Domain-Wide Delegation).
        description: `Free ${CONFIG.consultMinutes}-minute consult booked from the website.\nName: ${name}\nEmail: ${email}`,
        start: { dateTime: start.toISOString(), timeZone: timeZone || 'UTC' },
        end: { dateTime: end.toISOString(), timeZone: timeZone || 'UTC' },
      },
    });

    const meetLink = event.data.hangoutLink || '';

    // 2) Send the confirmation email -----------------------------------------
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { subject, text, html } = buildEmail({ name, dateLabel, timeLabel, meetLink });
    const sent = await resend.emails.send({ from: CONFIG.fromEmail, to: email, subject, text, html });
    // The Resend SDK does NOT throw on API errors — it returns { error }.
    // Surface it so a failed email can't masquerade as success.
    if (sent && sent.error) {
      throw new Error(`Email failed: ${sent.error.message || JSON.stringify(sent.error)}`);
    }

    res.status(200).json({ message: 'Booked! Confirmation sent.', meetLink });
  } catch (err) {
    console.error('Booking error:', err);
    // TEMP DEBUG: surface the real reason on the page so we can diagnose.
    // Remove this detail (go back to a generic message) once it's working.
    res.status(500).json({
      message: 'Could not complete the booking. Please try again.',
      debug: (err && err.message) || String(err),
    });
  }
};

// ------------------------------ HELPERS --------------------------------------
function getCalendarClient() {
  // Service-account auth. The private key is stored as an env var; \n escapes
  // are converted back to real newlines.
  const auth = new google.auth.JWT(
    process.env.GOOGLE_CLIENT_EMAIL,
    null,
    (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    ['https://www.googleapis.com/auth/calendar.events']
  );
  return google.calendar({ version: 'v3', auth });
}

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
