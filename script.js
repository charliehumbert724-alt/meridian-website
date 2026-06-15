// Current year in footer
document.getElementById('year').textContent = new Date().getFullYear();

// Mobile menu toggle
const toggle = document.querySelector('.menu-toggle');
const links = document.querySelector('.nav-links');
toggle.addEventListener('click', () => links.classList.toggle('open'));
links.addEventListener('click', (e) => {
  if (e.target.tagName === 'A') links.classList.remove('open');
});

// Reveal sections on scroll
const revealEls = document.querySelectorAll('section, .card, .steps li');
revealEls.forEach((el) => el.classList.add('reveal'));

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12 }
);
revealEls.forEach((el) => observer.observe(el));

/* =========================================================
   Booking modal — free 20-min consult
   Demo only: nothing is actually sent or saved.
   See the chat notes for how to connect Google Calendar
   and real automated confirmation emails.
   ========================================================= */
const modal = document.getElementById('bookingModal');
const dateList = document.getElementById('dateList');
const timeList = document.getElementById('timeList');
const selectionSummary = document.getElementById('selectionSummary');
const confirmBtn = document.getElementById('confirmBtn');

let selected = { date: null, time: null, isoDate: null, isoTime: null };
const pad = (n) => String(n).padStart(2, '0');

// Busy time ranges pulled from the calendar (via /api/availability) so that
// slots that are already booked show up crossed out and can't be selected.
const CONSULT_MINUTES = 20;
let busyIntervals = []; // [{ start: ms, end: ms }]

async function fetchAvailability() {
  try {
    const res = await fetch('/api/availability');
    const data = await res.json();
    busyIntervals = (data.busy || []).map((b) => ({
      start: new Date(b.start).getTime(),
      end: new Date(b.end).getTime(),
    }));
  } catch (err) {
    busyIntervals = []; // fail open — never block booking if this errors
  }
}

// Does a slot [startMs, endMs) overlap any busy range?
function slotIsBusy(startMs, endMs) {
  return busyIntervals.some((b) => startMs < b.end && endMs > b.start);
}

// Open / close
document.querySelectorAll('[data-open-booking]').forEach((btn) =>
  btn.addEventListener('click', openBooking)
);
document.querySelectorAll('[data-close-booking]').forEach((btn) =>
  btn.addEventListener('click', closeBooking)
);
modal.addEventListener('click', (e) => {
  if (e.target === modal) closeBooking();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modal.classList.contains('open')) closeBooking();
});

function openBooking() {
  buildDates();
  // Load taken slots, then refresh times if a date is already chosen.
  fetchAvailability().then(() => {
    if (selected.isoDate) buildTimes();
  });
  document.getElementById('stepPick').hidden = false;
  document.getElementById('stepDone').hidden = true;
  selected = { date: null, time: null, isoDate: null, isoTime: null };
  updateSummary();
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}
function closeBooking() {
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

// Let other pages (e.g. the blog) open the booking modal by linking to
// "index.html#book".
if (window.location.hash === '#book') openBooking();

// Build the next ~3 weeks of bookable days (Monday–Saturday, skip Sundays)
function buildDates() {
  dateList.innerHTML = '';
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const today = new Date();
  let added = 0;
  for (let i = 1; added < 18; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    if (d.getDay() === 0) continue; // skip Sunday
    const btn = document.createElement('button');
    btn.className = 'date-btn';
    btn.innerHTML = `${days[d.getDay()]}<small>${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}</small>`;
    btn.addEventListener('click', () => {
      document.querySelectorAll('.date-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      selected.date = `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
      selected.isoDate = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      selected.time = null;
      selected.isoTime = null;
      buildTimes();
      updateSummary();
    });
    dateList.appendChild(btn);
    added++;
  }
}

// Time slots every 30 min, 10:00 -> 16:30 (20-min consult ends before 5:00)
function buildTimes() {
  timeList.innerHTML = '';
  for (let mins = 10 * 60; mins <= 16 * 60 + 30; mins += 30) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const label = `${((h + 11) % 12) + 1}:${m === 0 ? '00' : m} ${h < 12 ? 'AM' : 'PM'}`;
    const btn = document.createElement('button');
    btn.className = 'time-btn';
    btn.textContent = label;

    // Is this slot already taken on the calendar? If so, leave it visible but
    // crossed out and unclickable.
    const startMs = new Date(`${selected.isoDate}T${pad(h)}:${pad(m)}:00`).getTime();
    const endMs = startMs + CONSULT_MINUTES * 60 * 1000;

    if (slotIsBusy(startMs, endMs)) {
      btn.classList.add('unavailable');
      btn.disabled = true;
      btn.title = 'Already booked';
    } else {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.time-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        selected.time = label;
        selected.isoTime = `${pad(h)}:${pad(m)}`;
        updateSummary();
      });
    }
    timeList.appendChild(btn);
  }
}

function updateSummary() {
  if (selected.date && selected.time) {
    selectionSummary.textContent = `📅 ${selected.date} at ${selected.time}`;
    confirmBtn.disabled = false;
  } else if (selected.date) {
    selectionSummary.textContent = `📅 ${selected.date} — now pick a time.`;
    confirmBtn.disabled = true;
  } else {
    selectionSummary.textContent = 'No time selected yet.';
    confirmBtn.disabled = true;
  }
}

// Confirm -> POST to the backend, which creates the calendar event
// and sends the confirmation email (see api/book.js + BACKEND_SETUP.md).
confirmBtn.addEventListener('click', async () => {
  const name = document.getElementById('bookName').value.trim();
  const email = document.getElementById('bookEmail').value.trim();
  if (!name || !email) {
    selectionSummary.textContent = '⚠️ Please add your name and email.';
    return;
  }

  const original = confirmBtn.textContent;
  confirmBtn.disabled = true;
  confirmBtn.textContent = 'Booking…';

  // Local datetime the user picked, plus their timezone so the
  // server can create the calendar event at the correct moment.
  const startISO = `${selected.isoDate}T${selected.isoTime}:00`;
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  let ok = false;
  let message = '';
  try {
    const res = await fetch('/api/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        email,
        startISO,
        timeZone,
        dateLabel: selected.date,
        timeLabel: selected.time,
      }),
    });
    const data = await res.json().catch(() => ({}));
    ok = res.ok;
    message = data.message || (ok ? '' : 'Something went wrong.');
  } catch (err) {
    // No backend reachable (e.g. opening the file locally without `vercel dev`)
    message = 'Backend not connected yet — this is the demo flow. See BACKEND_SETUP.md.';
  }

  // Show the confirmation step either way so the flow is visible.
  document.getElementById('doneSummary').textContent =
    `${selected.date} at ${selected.time} · Confirmation ${ok ? 'sent' : 'will go'} to ${email}.`;

  document.getElementById('emailSubject').value =
    'Your free 20-min consult with expon3nt is confirmed ✅';
  document.getElementById('emailBody').value =
`Hi ${name},

Thanks for booking a free 20-minute consult with expon3nt — I'm looking forward to it!

  🗓  ${selected.date}
  🕒  ${selected.time} (20 minutes)
  📍  Video call — link to follow

Before we talk, feel free to reply with anything you'd like to focus on
(SEO, social media, your website, or all three).

Talk soon,
expon3nt
hello@expon3nt.com`;

  document.getElementById('sendNote').textContent = ok
    ? '✓ Booked — a Google Calendar invite and confirmation email are on their way.'
    : `ℹ️ ${message}`;

  document.getElementById('stepPick').hidden = true;
  document.getElementById('stepDone').hidden = false;
  confirmBtn.disabled = false;
  confirmBtn.textContent = original;
});

// Contact form — submits to Formspree via AJAX so the visitor stays on the
// page and sees an inline success/error message (no redirect).
async function handleSubmit(event) {
  event.preventDefault();
  const form = event.target;
  const note = document.getElementById('formNote');
  const name = form.name.value.trim();
  const submitBtn = form.querySelector('button[type="submit"]');
  const original = submitBtn ? submitBtn.textContent : '';

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending…';
  }
  note.textContent = '';

  try {
    const res = await fetch(form.action, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: new FormData(form),
    });

    if (res.ok) {
      note.textContent = `Thanks${name ? ', ' + name : ''}! Your message is on its way — I'll be in touch soon.`;
      form.reset();
    } else {
      // Formspree returns { errors: [{ message }] } on validation/config errors.
      const data = await res.json().catch(() => ({}));
      const msg = data.errors ? data.errors.map((e) => e.message).join(', ') : 'Something went wrong.';
      note.textContent = `⚠️ ${msg} Please try again, or email me directly.`;
    }
  } catch (err) {
    note.textContent = '⚠️ Network error — please try again, or email me directly.';
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = original;
    }
  }

  return false;
}
