const crypto = require("crypto");

const SITE_EMAIL = "nevenajeremic@lablifehub.com";
const DEFAULT_FROM_EMAIL = "LabLifeHub <nevenajeremic@lablifehub.com>";
const DEFAULT_TIME_ZONE = "Europe/Belgrade";

function clean(value, max) {
  return (value || "").toString().trim().slice(0, max);
}

function esc(value) {
  return String(value || "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

function getFromEmail() {
  return (process.env.BOOKING_FROM_EMAIL || DEFAULT_FROM_EMAIL).trim();
}

function getBaseUrl(req) {
  if (process.env.SITE_ORIGIN) return process.env.SITE_ORIGIN.replace(/\/+$/, "");
  const host = (req.headers["x-forwarded-host"] || req.headers.host || "lablifehub.com")
    .toString()
    .split(",")[0]
    .trim();
  const proto = (req.headers["x-forwarded-proto"] || "https").toString().split(",")[0].trim();
  return proto + "://" + host;
}

function base64url(input) {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function unbase64url(input) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized + "=".repeat((4 - (normalized.length % 4)) % 4), "base64").toString("utf8");
}

function actionSecret() {
  return process.env.BOOKING_ACTION_SECRET || process.env.RESEND_API_KEY || "";
}

function hmac(body) {
  const secret = actionSecret();
  if (!secret) throw new Error("Booking action secret is not configured");
  return crypto.createHmac("sha256", secret).update(body).digest("base64url");
}

function signBooking(booking) {
  const body = base64url(JSON.stringify({ v: 1, iat: Date.now(), booking }));
  return body + "." + hmac(body);
}

function verifyBookingToken(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 2) throw new Error("Invalid booking token");
  const [body, signature] = parts;
  const expected = hmac(body);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new Error("Invalid booking signature");
  }
  const payload = JSON.parse(unbase64url(body));
  const maxAgeDays = Number(process.env.BOOKING_ACTION_MAX_AGE_DAYS || 90);
  if (!payload.iat || Date.now() - payload.iat > maxAgeDays * 24 * 60 * 60 * 1000) {
    throw new Error("Booking action link expired");
  }
  return payload.booking || {};
}

function bookingId(booking) {
  return crypto
    .createHash("sha256")
    .update([
      booking.service,
      booking.name,
      booking.email,
      booking.phone,
      booking.preferredLanguage || booking.language,
      booking.date,
      booking.message,
      booking.submittedAt,
    ].join("|"))
    .digest("hex")
    .slice(0, 32);
}

function actionUrl(req, action, token) {
  const url = new URL("/api/booking-action", getBaseUrl(req));
  url.searchParams.set("action", action);
  url.searchParams.set("token", token);
  return url.href;
}

function actionButton(label, href, bg, color, border) {
  return (
    '<a href="' +
    esc(href) +
    '" style="display:inline-block;margin:0 8px 10px 0;padding:12px 16px;border-radius:999px;' +
    "background:" +
    bg +
    ";color:" +
    color +
    ";border:1px solid " +
    (border || bg) +
    ';font-weight:700;text-decoration:none;font-size:14px;">' +
    esc(label) +
    "</a>"
  );
}

function bookingDetailsHtml(booking) {
  return (
    "<p><strong>Service:</strong> " +
    esc(booking.service) +
    "</p>" +
    "<p><strong>Name:</strong> " +
    esc(booking.name) +
    "</p>" +
    "<p><strong>Email:</strong> " +
    esc(booking.email) +
    "</p>" +
    "<p><strong>Phone:</strong> " +
    (esc(booking.phone) || "-") +
    "</p>" +
    "<p><strong>Preferred language:</strong> " +
    (esc(booking.preferredLanguage || booking.language) || "-") +
    "</p>" +
    "<p><strong>Preferred date:</strong> " +
    (esc(booking.date) || "-") +
    "</p>" +
    "<p><strong>Message:</strong><br/>" +
    (esc(booking.message).replace(/\n/g, "<br/>") || "-") +
    "</p>"
  );
}

async function sendEmail({ to, subject, html, text, replyTo, cc, bcc, attachments, idempotencyKey }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: true, configured: false };

  const headers = {
    Authorization: "Bearer " + key,
    "Content-Type": "application/json",
  };
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey.slice(0, 256);

  const payload = {
    from: getFromEmail(),
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
  };
  if (text) payload.text = text;
  if (replyTo) payload.reply_to = replyTo;
  if (cc) payload.cc = cc;
  if (bcc) payload.bcc = bcc;
  if (attachments && attachments.length) payload.attachments = attachments;

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!r.ok) {
    const detail = await r.text();
    const error = new Error("Email provider error");
    error.detail = detail;
    error.status = r.status;
    throw error;
  }

  return { ok: true, configured: true, data: await r.json().catch(() => ({})) };
}

module.exports = {
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
};
