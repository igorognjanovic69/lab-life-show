// Vercel Serverless Function - receives a booking request and emails it
// to Dr. Jeremić via Resend (https://resend.com, free tier is enough).
//
// Set these in Vercel → Project → Settings → Environment Variables:
//   RESEND_API_KEY     = your Resend API key
//   BOOKING_FROM_EMAIL = optional verified sender, defaults to LabLifeHub <nevenajeremic@lablifehub.com>
//
// Until RESEND_API_KEY is set, the function returns { ok:true, configured:false }
// and the site shows a local confirmation instead.
//
// Booking requests are always delivered to nevenajeremic@lablifehub.com.

const {
  SITE_EMAIL,
  actionButton,
  actionUrl,
  bookingDetailsHtml,
  clean,
  esc,
  sendEmail,
  signBooking,
} = require("../lib/booking-utils.cjs");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const service = clean(body.service, 200);
  const name = clean(body.name, 200);
  const email = clean(body.email, 200);
  const phone = clean(body.phone, 100);
  const date = clean(body.date, 100);
  const message = clean(body.message, 4000);

  if (!name || !email || !phone || !service) {
    return res.status(400).json({ ok: false, error: "Missing required fields" });
  }

  // Not configured yet - let the front-end show its local confirmation.
  if (!process.env.RESEND_API_KEY) {
    return res.status(200).json({ ok: true, configured: false });
  }

  const booking = { service, name, email, phone, date, message, submittedAt: new Date().toISOString() };
  const token = signBooking(booking);
  const acceptLink = actionUrl(req, "accept", token);
  const changeLink = actionUrl(req, "propose", token);
  const declineLink = actionUrl(req, "decline", token);
  const subject = "New booking request: " + service;
  const html =
    "<h2>New booking request - LabLifeAcademy</h2>" +
    bookingDetailsHtml(booking) +
    "<div style=\"margin:28px 0 18px;padding:20px;border:1px solid #e5e7eb;border-radius:16px;background:#f8faf9;\">" +
    "<p style=\"margin:0 0 14px;font-weight:700;color:#26302e;\">Booking actions</p>" +
    "<p style=\"margin:0 0 16px;color:#4b5563;font-size:14px;line-height:1.5;\">Use these secure action links to confirm the booking, propose a new date/time, or decline. Accept can create a Google Calendar event when Google Calendar is connected.</p>" +
    actionButton("Accept", acceptLink, "#179389", "#ffffff") +
    actionButton("Change date & time", changeLink, "#b7d63d", "#26302e") +
    actionButton("Decline", declineLink, "#ffffff", "#26302e", "#d1d5db") +
    "</div>" +
    "<p style=\"font-size:13px;color:#6b7280;line-height:1.5;\">If buttons do not work in your email client, open these links: " +
    '<a href="' + esc(acceptLink) + '">Accept</a> · ' +
    '<a href="' + esc(changeLink) + '">Change date & time</a> · ' +
    '<a href="' + esc(declineLink) + '">Decline</a></p>';

  try {
    await sendEmail({
      to: SITE_EMAIL,
      replyTo: email,
      subject,
      html,
    });
    return res.status(200).json({ ok: true, configured: true });
  } catch (e) {
    return res.status(e.status || 500).json({ ok: false, error: String(e.message || e), detail: e.detail });
  }
};
