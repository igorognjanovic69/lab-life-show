const crypto = require("crypto");
const {
  SITE_EMAIL,
  DEFAULT_TIME_ZONE,
  bookingDetailsHtml,
  bookingId,
  clean,
  esc,
  getBaseUrl,
  sendEmail,
  verifyBookingToken,
} = require("../lib/booking-utils.cjs");

module.exports = async (req, res) => {
  try {
    if (req.method === "GET") return await renderAction(req, res);
    if (req.method === "POST") return await processAction(req, res);
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (e) {
    const message = e.message || String(e);
    const status = /Invalid booking|expired|signature/.test(message) ? 400 : 500;
    return sendHtml(res, status, page("Booking action error", errorBox(message)));
  }
};

async function renderAction(req, res) {
  const url = new URL(req.url, getBaseUrl(req));
  const action = clean(url.searchParams.get("action"), 40);
  const token = url.searchParams.get("token") || "";
  const booking = verifyBookingToken(token);
  if (!["accept", "propose", "decline"].includes(action)) {
    return sendHtml(res, 400, page("Invalid action", errorBox("Unknown booking action.")));
  }
  return sendHtml(res, 200, renderForm(action, token, booking));
}

async function processAction(req, res) {
  const form = await readForm(req);
  const action = clean(form.action, 40);
  const token = form.token || "";
  const booking = verifyBookingToken(token);

  if (action === "accept") return acceptBooking(req, res, booking, form);
  if (action === "propose") return proposeTime(req, res, booking, form);
  if (action === "decline") return declineBooking(req, res, booking, form);
  return sendHtml(res, 400, page("Invalid action", errorBox("Unknown booking action.")));
}

async function acceptBooking(req, res, booking, form) {
  const slot = parseSlot(form, booking);
  if (!slot.ok) return sendHtml(res, 400, renderForm("accept", form.token, booking, slot.error));

  const note = clean(form.note, 1200);
  const eventId = calendarEventId(booking, slot);
  const calendar = await createGoogleCalendarEvent({ booking, slot, note, eventId });
  if (calendar.configured && !calendar.ok) {
    return sendHtml(
      res,
      502,
      page(
        "Calendar error",
        errorBox("Google Calendar could not create the event, so no confirmation email was sent.") +
          "<pre>" +
          esc(calendar.error || "Unknown calendar error") +
          "</pre>"
      )
    );
  }

  const html =
    "<h2>Your LabLifeAcademy booking is confirmed</h2>" +
    "<p>Dear " +
    esc(booking.name) +
    ",</p>" +
    "<p>Thank you for your booking request. Your session has been confirmed.</p>" +
    bookingDetailsHtml({ ...booking, date: humanSlot(slot) }) +
    (note ? "<p><strong>Note from Dr. Nevena Jeremić:</strong><br/>" + esc(note).replace(/\n/g, "<br/>") + "</p>" : "") +
    (calendar.ok && calendar.htmlLink
      ? '<p><a href="' + esc(calendar.htmlLink) + '">Open calendar event</a></p>'
      : "<p>A calendar invite is attached to this email.</p>") +
    footer();

  const ics = buildIcs({ booking, slot, note, eventId });
  await sendEmail({
    to: booking.email,
    bcc: SITE_EMAIL,
    replyTo: SITE_EMAIL,
    subject: "Booking confirmed: " + booking.service,
    html,
    attachments: [
      {
        filename: "lablifeacademy-booking.ics",
        content: Buffer.from(ics).toString("base64"),
        contentType: "text/calendar; charset=utf-8; method=REQUEST",
      },
    ],
    idempotencyKey: "booking-accept-" + eventId,
  });

  return sendHtml(
    res,
    200,
    page(
      "Booking confirmed",
      successBox("Confirmation email has been sent to " + esc(booking.email) + ".") +
        (calendar.ok
          ? successBox("Google Calendar event created." + (calendar.htmlLink ? ' <a href="' + esc(calendar.htmlLink) + '">Open event</a>' : ""))
          : infoBox("Google Calendar is not connected yet. The candidate received an .ics invite, and Nevena received a copy by email."))
    )
  );
}

async function proposeTime(req, res, booking, form) {
  const slot = parseSlot(form, booking);
  if (!slot.ok) return sendHtml(res, 400, renderForm("propose", form.token, booking, slot.error));

  const note = clean(form.note, 1200);
  const html =
    "<h2>Alternative date and time proposal</h2>" +
    "<p>Dear " +
    esc(booking.name) +
    ",</p>" +
    "<p>Thank you for your booking request for <strong>" +
    esc(booking.service) +
    "</strong>.</p>" +
    "<p>Dr. Nevena Jeremić would like to suggest this alternative time:</p>" +
    "<p><strong>" +
    esc(humanSlot(slot)) +
    "</strong></p>" +
    (note ? "<p><strong>Note:</strong><br/>" + esc(note).replace(/\n/g, "<br/>") + "</p>" : "") +
    "<p>Please reply to this email to confirm whether this works for you.</p>" +
    footer();

  await sendEmail({
    to: booking.email,
    bcc: SITE_EMAIL,
    replyTo: SITE_EMAIL,
    subject: "Alternative date/time: " + booking.service,
    html,
    idempotencyKey: "booking-propose-" + bookingId(booking) + "-" + hash(slot.startDateTime + note),
  });

  return sendHtml(
    res,
    200,
    page("Alternative time sent", successBox("Alternative date/time proposal has been sent to " + esc(booking.email) + "."))
  );
}

async function declineBooking(req, res, booking, form) {
  const note = clean(form.note, 1200);
  const html =
    "<h2>Booking request update</h2>" +
    "<p>Dear " +
    esc(booking.name) +
    ",</p>" +
    "<p>Thank you for your booking request for <strong>" +
    esc(booking.service) +
    "</strong>.</p>" +
    "<p>Unfortunately, Dr. Nevena Jeremić is unable to accept this booking request at the requested time.</p>" +
    (note ? "<p><strong>Note:</strong><br/>" + esc(note).replace(/\n/g, "<br/>") + "</p>" : "") +
    footer();

  await sendEmail({
    to: booking.email,
    bcc: SITE_EMAIL,
    replyTo: SITE_EMAIL,
    subject: "Booking request update: " + booking.service,
    html,
    idempotencyKey: "booking-decline-" + bookingId(booking) + "-" + hash(note),
  });

  return sendHtml(res, 200, page("Booking declined", successBox("Decline email has been sent to " + esc(booking.email) + ".")));
}

function renderForm(action, token, booking, error) {
  const title =
    action === "accept" ? "Accept booking" : action === "propose" ? "Propose new date & time" : "Decline booking";
  const submit =
    action === "accept" ? "Confirm and send" : action === "propose" ? "Send proposal" : "Send decline";
  const preferredDate = /^\d{4}-\d{2}-\d{2}$/.test(booking.date || "") ? booking.date : "";
  const dateTimeFields =
    action === "decline"
      ? ""
      : '<div class="grid">' +
        '<label>Date<input required type="date" name="date" value="' +
        esc(preferredDate) +
        '"></label>' +
        '<label>Time<input required type="time" name="time" value="' +
        esc(process.env.BOOKING_DEFAULT_TIME || "10:00") +
        '"></label>' +
        '<label>Duration (minutes)<input required type="number" min="15" max="600" step="15" name="duration" value="' +
        String(defaultDuration(booking.service)) +
        '"></label>' +
        "</div>";

  return page(
    title,
    (error ? errorBox(error) : "") +
      '<div class="card">' +
      "<h1>" +
      esc(title) +
      "</h1>" +
      '<div class="details">' +
      bookingDetailsHtml(booking) +
      "</div>" +
      '<form method="POST" action="/api/booking-action">' +
      '<input type="hidden" name="token" value="' +
      esc(token) +
      '">' +
      '<input type="hidden" name="action" value="' +
      esc(action) +
      '">' +
      dateTimeFields +
      '<label>Optional message<textarea name="note" rows="5" placeholder="Add a note for the requester..."></textarea></label>' +
      '<button type="submit">' +
      esc(submit) +
      "</button>" +
      "</form>" +
      "</div>"
  );
}

function parseSlot(form, booking) {
  const date = clean(form.date || booking.date, 20);
  const time = clean(form.time, 20);
  const duration = Math.min(Math.max(parseInt(form.duration || defaultDuration(booking.service), 10) || 60, 15), 600);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: "Please enter a valid date." };
  if (!/^\d{2}:\d{2}$/.test(time)) return { ok: false, error: "Please enter a valid time." };
  const startDateTime = date + "T" + time + ":00";
  const endDateTime = addMinutes(date, time, duration);
  return {
    ok: true,
    date,
    time,
    duration,
    startDateTime,
    endDateTime,
    timeZone: process.env.BOOKING_TIME_ZONE || DEFAULT_TIME_ZONE,
  };
}

function addMinutes(date, time, duration) {
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, h, min));
  dt.setUTCMinutes(dt.getUTCMinutes() + duration);
  return (
    dt.getUTCFullYear() +
    "-" +
    pad(dt.getUTCMonth() + 1) +
    "-" +
    pad(dt.getUTCDate()) +
    "T" +
    pad(dt.getUTCHours()) +
    ":" +
    pad(dt.getUTCMinutes()) +
    ":00"
  );
}

function humanSlot(slot) {
  return slot.date + " at " + slot.time + " (" + slot.timeZone + "), " + slot.duration + " minutes";
}

function defaultDuration(service) {
  const s = String(service || "").toLowerCase();
  if (s.includes("one-day") || s.includes("jednodnevni")) return 300;
  if (s.includes("two-day") || s.includes("dvodnevni")) return 180;
  if (s.includes("workshop") || s.includes("radionica")) return 90;
  return 60;
}

async function createGoogleCalendarEvent({ booking, slot, note, eventId }) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  const calendarId = process.env.GOOGLE_CALENDAR_ID || "primary";
  if (!clientId || !clientSecret || !refreshToken) {
    return { configured: false, ok: false };
  }

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }).toString(),
    });
    if (!tokenResponse.ok) {
      return { configured: true, ok: false, error: await tokenResponse.text() };
    }
    const token = await tokenResponse.json();

    const event = {
      id: eventId,
      summary: booking.service + " - " + booking.name,
      description:
        "LabLifeAcademy booking\\n\\n" +
        "Name: " +
        booking.name +
        "\\nEmail: " +
        booking.email +
        "\\nPhone: " +
        booking.phone +
        "\\nService: " +
        booking.service +
        (note ? "\\n\\nNote: " + note : ""),
      start: { dateTime: slot.startDateTime, timeZone: slot.timeZone },
      end: { dateTime: slot.endDateTime, timeZone: slot.timeZone },
      attendees: [{ email: booking.email, displayName: booking.name }],
      reminders: {
        useDefault: false,
        overrides: [
          { method: "email", minutes: 24 * 60 },
          { method: "popup", minutes: 30 },
        ],
      },
    };

    const insertUrl =
      "https://www.googleapis.com/calendar/v3/calendars/" +
      encodeURIComponent(calendarId) +
      "/events?sendUpdates=all";
    const r = await fetch(insertUrl, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token.access_token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    });
    if (r.status === 409) return { configured: true, ok: true, alreadyExists: true };
    if (!r.ok) return { configured: true, ok: false, error: await r.text() };
    const created = await r.json();
    return { configured: true, ok: true, htmlLink: created.htmlLink || "" };
  } catch (e) {
    return { configured: true, ok: false, error: String(e) };
  }
}

function calendarEventId(booking, slot) {
  return "llh" + hash(bookingId(booking) + "|" + slot.startDateTime).slice(0, 32);
}

function buildIcs({ booking, slot, note, eventId }) {
  const summary = booking.service + " - " + booking.name;
  const description =
    "LabLifeAcademy booking\\n" +
    "Name: " +
    booking.name +
    "\\nEmail: " +
    booking.email +
    "\\nPhone: " +
    booking.phone +
    "\\nService: " +
    booking.service +
    (note ? "\\nNote: " + note : "");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//LabLifeHub//Booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    "UID:" + eventId + "@lablifehub.com",
    "DTSTAMP:" + utcStamp(new Date()),
    "ORGANIZER;CN=Dr. Nevena Jeremic:mailto:" + SITE_EMAIL,
    "DTSTART;TZID=" + slot.timeZone + ":" + icsLocal(slot.startDateTime),
    "DTEND;TZID=" + slot.timeZone + ":" + icsLocal(slot.endDateTime),
    "SUMMARY:" + icsEscape(summary),
    "DESCRIPTION:" + icsEscape(description),
    "ATTENDEE;CN=" + icsEscape(booking.name) + ";ROLE=REQ-PARTICIPANT;RSVP=TRUE:mailto:" + booking.email,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

function icsEscape(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

function icsLocal(dateTime) {
  return dateTime.replace(/[-:]/g, "");
}

function utcStamp(date) {
  return (
    date.getUTCFullYear() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    "T" +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    "Z"
  );
}

function foldLine(line) {
  const out = [];
  let current = String(line);
  while (current.length > 74) {
    out.push(current.slice(0, 74));
    current = " " + current.slice(74);
  }
  out.push(current);
  return out.join("\r\n");
}

function footer() {
  return '<p style="margin-top:24px;">Best regards,<br/>Dr. Nevena Jeremić<br/>LabLifeHub</p>';
}

function page(title, content) {
  return (
    "<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">" +
    "<title>" +
    esc(title) +
    " - LabLifeHub</title>" +
    "<style>body{font-family:Inter,Arial,sans-serif;background:#f3f5f4;color:#26302e;margin:0;padding:28px}main{max-width:820px;margin:auto}.card,.box{background:white;border:1px solid #e5e7eb;border-radius:22px;padding:24px;box-shadow:0 18px 45px rgba(38,48,46,.08)}h1{margin-top:0}p{line-height:1.55}.details{background:#f8faf9;border-radius:16px;padding:16px;margin:18px 0}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px}label{display:block;font-weight:700;margin:14px 0 6px}input,textarea{box-sizing:border-box;width:100%;border:1px solid #d1d5db;border-radius:14px;padding:12px;font:inherit}button{border:0;border-radius:999px;background:#179389;color:white;padding:13px 18px;font-weight:800;cursor:pointer}.success{border-color:#b7d63d}.error{border-color:#ef4444}.info{border-color:#93c5fd}pre{white-space:pre-wrap;background:#111827;color:#f9fafb;border-radius:14px;padding:16px;overflow:auto}</style></head>" +
    "<body><main>" +
    content +
    "</main></body></html>"
  );
}

function successBox(message) {
  return '<div class="box success"><p>' + message + "</p></div>";
}

function errorBox(message) {
  return '<div class="box error"><p>' + esc(message) + "</p></div>";
}

function infoBox(message) {
  return '<div class="box info"><p>' + message + "</p></div>";
}

function sendHtml(res, status, html) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(status);
  return res.end(html);
}

async function readForm(req) {
  if (req.body && typeof req.body === "object") return req.body;
  let raw = "";
  if (typeof req.body === "string") raw = req.body;
  else {
    raw = await new Promise((resolve, reject) => {
      const chunks = [];
      req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      req.on("error", reject);
    });
  }
  const params = new URLSearchParams(raw);
  return Object.fromEntries(params.entries());
}

function hash(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function pad(n) {
  return String(n).padStart(2, "0");
}
