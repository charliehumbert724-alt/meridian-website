// =============================================================================
//  GET /api/availability  — Vercel serverless function
//
//  Returns the "busy" time ranges on the calendar over the next few weeks so
//  the booking UI can cross out slots that are already taken. This covers both
//  consults booked through the site AND any other events on that calendar, so
//  visitors can never double-book a time you're not actually free.
//
//  Uses the same Google service account as api/book.js (read-only here).
// =============================================================================

const { google } = require('googleapis');

// Keep this in sync with CONFIG.calendarId in api/book.js.
const CALENDAR_ID = 'charliehumbert724@gmail.com';

module.exports = async (req, res) => {
  try {
    const timeMin = new Date();
    // ~25 days covers the ~3 weeks of bookable days the UI shows.
    const timeMax = new Date(timeMin.getTime() + 25 * 24 * 60 * 60 * 1000);

    const calendar = getCalendarClient();
    const fb = await calendar.freebusy.query({
      requestBody: {
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        items: [{ id: CALENDAR_ID }],
      },
    });

    const cal = fb.data.calendars && fb.data.calendars[CALENDAR_ID];
    const busy = (cal && cal.busy) || []; // [{ start, end }] in ISO/UTC
    res.status(200).json({ busy });
  } catch (err) {
    console.error('Availability error:', err);
    // Fail open: if we can't read the calendar, return no busy slots so the
    // booking flow still works (worst case, an overlap is caught at booking).
    res.status(200).json({ busy: [] });
  }
};

function getCalendarClient() {
  const auth = new google.auth.JWT(
    process.env.GOOGLE_CLIENT_EMAIL,
    null,
    (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    ['https://www.googleapis.com/auth/calendar.readonly']
  );
  return google.calendar({ version: 'v3', auth });
}
