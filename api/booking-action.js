const crypto = require("crypto");
const {
  SITE_EMAIL,
  DEFAULT_TIME_ZONE,
  actionButton,
  actionUrl,
  bookingDetailsHtml,
  bookingId,
  clean,
  esc,
  getBaseUrl,
  sendEmail,
  signBooking,
  verifyBookingToken,
} = require("../lib/booking-utils.cjs");

const ADMIN_ACTIONS = ["accept", "propose", "decline"];
const CLIENT_PROPOSAL_ACTIONS = ["accept-proposal", "request-change"];

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

  if (CLIENT_PROPOSAL_ACTIONS.includes(action)) {
    const proposal = verifyProposalToken(token);
    if (action === "accept-proposal") {
      return sendHtml(res, 200, renderProposalAcceptForm(token, proposal));
    }
    return sendHtml(res, 200, renderProposalChangeForm(token, proposal));
  }

  const booking = verifyBookingToken(token);
  if (!ADMIN_ACTIONS.includes(action)) {
    return sendHtml(res, 400, page("Invalid action", errorBox("Unknown booking action.")));
  }
  return sendHtml(res, 200, renderForm(action, token, booking, "", queryPrefill(url)));
}

async function processAction(req, res) {
  const form = await readForm(req);
  const action = clean(form.action, 40);
  const token = form.token || "";

  if (CLIENT_PROPOSAL_ACTIONS.includes(action)) {
    const proposal = verifyProposalToken(token);
    if (action === "accept-proposal") return acceptProposedTime(req, res, proposal, form);
    return requestDifferentTime(req, res, proposal, form);
  }

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
    bookingDetailsHtml(publicBooking({ ...booking, date: humanSlot(slot) })) +
    (note ? "<p><strong>Note from Dr. Nevena Jeremić:</strong><br/>" + esc(note).replace(/\n/g, "<br/>") + "</p>" : "") +
    (calendar.ok && calendar.htmlLink
      ? '<p><a href="' + esc(calendar.htmlLink) + '">Open calendar event</a></p>'
      : "<p>A calendar invite is attached to this email.</p>") +
    footer();

  const ics = buildIcs({ booking, slot, note, eventId });
  await sendEmail({
    to: booking.email,
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
          : infoBox("Google Calendar is not connected yet. The requester received an .ics invite."))
    )
  );
}

async function proposeTime(req, res, booking, form) {
  const slot = parseSlot(form, booking);
  if (!slot.ok) return sendHtml(res, 400, renderForm("propose", form.token, booking, slot.error));

  const note = clean(form.note, 1200);
  const proposalToken = signProposal(booking, slot, note);
  const acceptProposalLink = actionUrl(req, "accept-proposal", proposalToken);
  const requestChangeLink = actionUrl(req, "request-change", proposalToken);
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
    "<div style=\"margin:28px 0 18px;padding:20px;border:1px solid #e5e7eb;border-radius:16px;background:#f8faf9;\">" +
    "<p style=\"margin:0 0 14px;font-weight:700;color:#26302e;\">Does this time work for you?</p>" +
    "<p style=\"margin:0 0 16px;color:#4b5563;font-size:14px;line-height:1.5;\">Please use one of the buttons below. If the proposed time works, your session will be confirmed. If it does not, you can request another date/time.</p>" +
    actionButton("Accept proposed time", acceptProposalLink, "#179389", "#ffffff") +
    actionButton("Request another date/time", requestChangeLink, "#b7d63d", "#26302e") +
    "</div>" +
    "<p style=\"font-size:13px;color:#6b7280;line-height:1.5;\">You can also reply to this email if you prefer.</p>" +
    footer();

  await sendEmail({
    to: booking.email,
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

async function acceptProposedTime(req, res, proposal, form) {
  const booking = proposal.booking;
  const slot = proposal.slot;
  const requesterNote = clean(form.note, 1200);
  const note = [proposal.note, requesterNote ? "Requester note: " + requesterNote : ""].filter(Boolean).join("\n\n");
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
    "<p>Thank you for confirming the proposed date and time. Your session has been confirmed.</p>" +
    bookingDetailsHtml(publicBooking({ ...booking, date: humanSlot(slot) })) +
    (proposal.note ? "<p><strong>Note from Dr. Nevena Jeremić:</strong><br/>" + esc(proposal.note).replace(/\n/g, "<br/>") + "</p>" : "") +
    (requesterNote ? "<p><strong>Your note:</strong><br/>" + esc(requesterNote).replace(/\n/g, "<br/>") + "</p>" : "") +
    (calendar.ok && calendar.htmlLink
      ? '<p><a href="' + esc(calendar.htmlLink) + '">Open calendar event</a></p>'
      : "<p>A calendar invite is attached to this email.</p>") +
    footer();

  const ics = buildIcs({ booking, slot, note, eventId });
  await sendEmail({
    to: booking.email,
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
    idempotencyKey: "booking-proposal-accept-" + eventId,
  });
  await sendEmail({
    to: SITE_EMAIL,
    replyTo: booking.email,
    subject: "Client accepted proposed time: " + booking.service,
    html:
      "<h2>Client accepted the proposed time</h2>" +
      bookingDetailsHtml(publicBooking({ ...booking, date: humanSlot(slot) })) +
      (proposal.note ? "<p><strong>Your proposal note:</strong><br/>" + esc(proposal.note).replace(/\n/g, "<br/>") + "</p>" : "") +
      (requesterNote ? "<p><strong>Client note:</strong><br/>" + esc(requesterNote).replace(/\n/g, "<br/>") + "</p>" : "") +
      (calendar.ok && calendar.htmlLink
        ? '<p><a href="' + esc(calendar.htmlLink) + '">Open calendar event</a></p>'
        : ""),
    idempotencyKey: "booking-proposal-accepted-admin-" + eventId,
  });

  return sendHtml(
    res,
    200,
    page(
      "Booking confirmed",
      successBox("Thank you - your booking has been confirmed.") +
        successBox("Confirmation email has been sent to " + esc(booking.email) + ".") +
        (calendar.ok
          ? successBox("Google Calendar event created." + (calendar.htmlLink ? ' <a href="' + esc(calendar.htmlLink) + '">Open event</a>' : ""))
          : infoBox("Google Calendar is not connected yet. You received an .ics invite, and Dr. Nevena Jeremić has been notified by email."))
    )
  );
}

async function requestDifferentTime(req, res, proposal, form) {
  const booking = proposal.booking;
  const slot = parseSlot({ ...form, duration: proposal.slot.duration }, booking);
  if (!slot.ok) return sendHtml(res, 400, renderProposalChangeForm(form.token, proposal, slot.error));

  const note = clean(form.note, 1200);
  const followUpBooking = {
    ...booking,
    date: slot.date,
    message: publicMessage(booking.message),
    submittedAt: new Date().toISOString(),
  };
  const adminToken = signBooking(followUpBooking);
  const acceptRequestedLink = withSlotPrefill(actionUrl(req, "accept", adminToken), slot);
  const suggestAgainLink = withSlotPrefill(actionUrl(req, "propose", adminToken), slot);

  const html =
    "<h2>Requester asked for another date/time</h2>" +
    "<p><strong>" +
    esc(booking.name) +
    "</strong> responded to the alternative time proposal for <strong>" +
    esc(booking.service) +
    "</strong>.</p>" +
    bookingDetailsHtml(publicBooking(booking)) +
    "<p><strong>Previously proposed time:</strong><br/>" +
    esc(humanSlot(proposal.slot)) +
    "</p>" +
    "<p><strong>Requester suggested:</strong><br/>" +
    esc(humanSlot(slot)) +
    "</p>" +
    (note ? "<p><strong>Requester note:</strong><br/>" + esc(note).replace(/\n/g, "<br/>") + "</p>" : "") +
    "<div style=\"margin:28px 0 18px;padding:20px;border:1px solid #e5e7eb;border-radius:16px;background:#f8faf9;\">" +
    "<p style=\"margin:0 0 14px;font-weight:700;color:#26302e;\">Next step</p>" +
    "<p style=\"margin:0 0 16px;color:#4b5563;font-size:14px;line-height:1.5;\">Accept the requested time, or suggest another date/time. The fields will be prefilled with the requester's suggestion.</p>" +
    actionButton("Accept requested time", acceptRequestedLink, "#179389", "#ffffff") +
    actionButton("Suggest another time", suggestAgainLink, "#b7d63d", "#26302e") +
    "</div>";

  await sendEmail({
    to: SITE_EMAIL,
    replyTo: booking.email,
    subject: "Requester asked for another time: " + booking.service,
    html,
    idempotencyKey: "booking-client-change-" + bookingId(followUpBooking) + "-" + hash(slot.startDateTime + note),
  });

  return sendHtml(
    res,
    200,
    page(
      "Request sent",
      successBox("Thank you - your date/time request has been sent to Dr. Nevena Jeremić.") +
        infoBox("You will receive a confirmation or another proposal by email.")
    )
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
    replyTo: SITE_EMAIL,
    subject: "Booking request update: " + booking.service,
    html,
    idempotencyKey: "booking-decline-" + bookingId(booking) + "-" + hash(note),
  });

  return sendHtml(res, 200, page("Booking declined", successBox("Decline email has been sent to " + esc(booking.email) + ".")));
}

function renderForm(action, token, booking, error, prefill) {
  const title =
    action === "accept" ? "Accept booking" : action === "propose" ? "Propose new date & time" : "Decline booking";
  const submit =
    action === "accept" ? "Confirm and send" : action === "propose" ? "Send proposal" : "Send decline";
  const preferredDate =
    prefill && /^\d{4}-\d{2}-\d{2}$/.test(prefill.date || "")
      ? prefill.date
      : /^\d{4}-\d{2}-\d{2}$/.test(booking.date || "")
        ? booking.date
        : "";
  const preferredTime =
    prefill && /^\d{2}:\d{2}$/.test(prefill.time || "")
      ? prefill.time
      : process.env.BOOKING_DEFAULT_TIME || "10:00";
  const preferredDuration =
    prefill && /^\d+$/.test(prefill.duration || "")
      ? Math.min(Math.max(parseInt(prefill.duration, 10) || defaultDuration(booking.service), 15), 600)
      : defaultDuration(booking.service);
  const dateTimeFields =
    action === "decline"
      ? ""
      : '<div class="grid">' +
        '<label>Date<input required type="date" name="date" value="' +
        esc(preferredDate) +
        '"></label>' +
        '<label>Time<input required type="time" name="time" value="' +
        esc(preferredTime) +
        '"></label>' +
        '<label>Duration (minutes)<input required type="number" min="15" max="600" step="15" name="duration" value="' +
        String(preferredDuration) +
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

function renderProposalAcceptForm(token, proposal, error) {
  const booking = proposal.booking;
  const slot = proposal.slot;
  return page(
    "Accept proposed time",
    (error ? errorBox(error) : "") +
      '<div class="card">' +
      "<h1>Accept proposed time</h1>" +
      "<p>Please confirm that this proposed date and time works for you.</p>" +
      '<div class="details">' +
      bookingDetailsHtml({ ...booking, date: humanSlot(slot) }) +
      (proposal.note ? "<p><strong>Note from Dr. Nevena Jeremić:</strong><br/>" + esc(proposal.note).replace(/\n/g, "<br/>") + "</p>" : "") +
      "</div>" +
      '<form method="POST" action="/api/booking-action">' +
      '<input type="hidden" name="token" value="' +
      esc(token) +
      '">' +
      '<input type="hidden" name="action" value="accept-proposal">' +
      '<label>Optional note<textarea name="note" rows="4" placeholder="Add a short note if needed..."></textarea></label>' +
      '<button type="submit">Confirm proposed time</button>' +
      "</form>" +
      "</div>"
  );
}

function renderProposalChangeForm(token, proposal, error) {
  const booking = proposal.booking;
  const slot = proposal.slot;
  return page(
    "Request another date/time",
    (error ? errorBox(error) : "") +
      '<div class="card">' +
      "<h1>Request another date/time</h1>" +
      "<p>Please suggest a date and time that would work better for you.</p>" +
      '<div class="details">' +
      "<p><strong>Current proposed time:</strong><br/>" +
      esc(humanSlot(slot)) +
      "</p>" +
      bookingDetailsHtml(booking) +
      "</div>" +
      '<form method="POST" action="/api/booking-action">' +
      '<input type="hidden" name="token" value="' +
      esc(token) +
      '">' +
      '<input type="hidden" name="action" value="request-change">' +
      '<input type="hidden" name="duration" value="' +
      String(Math.min(Math.max(parseInt(slot.duration, 10) || defaultDuration(booking.service), 15), 600)) +
      '">' +
      '<div class="grid">' +
      '<label>Preferred date<input required type="date" name="date" value="' +
      esc(slot.date) +
      '"></label>' +
      '<label>Preferred time<input required type="time" name="time" value="' +
      esc(slot.time) +
      '"></label>' +
      "</div>" +
      '<label>Optional message<textarea name="note" rows="5" placeholder="Add a note for Dr. Nevena Jeremić..."></textarea></label>' +
      '<button type="submit">Send preferred time</button>' +
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
        "\\nPreferred language: " +
        (booking.preferredLanguage || booking.language || "-") +
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
    "\\nPreferred language: " +
    (booking.preferredLanguage || booking.language || "-") +
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

function publicBooking(booking) {
  return { ...booking, message: publicMessage(booking && booking.message) };
}

function publicMessage(value) {
  let message = clean(value, 4000);
  const markers = [
    "\n\nRequester asked for another date/time after the proposed slot:",
    "\nRequester asked for another date/time after the proposed slot:",
    "\n\nPreviously proposed time:",
    "\nPreviously proposed time:",
    "\n\nRequester suggested:",
    "\nRequester suggested:",
    "\n\nRequester note:",
    "\nRequester note:",
  ];

  for (const marker of markers) {
    const index = message.indexOf(marker);
    if (index >= 0) message = message.slice(0, index);
  }

  return message.trim();
}

function signProposal(booking, slot, note) {
  return signBooking({
    __type: "proposal",
    booking,
    slot,
    note,
    proposedAt: new Date().toISOString(),
  });
}

function verifyProposalToken(token) {
  const proposal = verifyBookingToken(token);
  if (!proposal || proposal.__type !== "proposal" || !proposal.booking || !proposal.slot) {
    throw new Error("Invalid proposal token");
  }
  return proposal;
}

function queryPrefill(url) {
  return {
    date: clean(url.searchParams.get("date"), 20),
    time: clean(url.searchParams.get("time"), 20),
    duration: clean(url.searchParams.get("duration"), 20),
  };
}

function withSlotPrefill(href, slot) {
  const url = new URL(href);
  url.searchParams.set("date", slot.date);
  url.searchParams.set("time", slot.time);
  url.searchParams.set("duration", String(slot.duration));
  return url.href;
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
