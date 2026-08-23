const crypto = require("crypto");

const COOKIE_NAME = "llh_admin_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 14;

function isAdminConfigured() {
  return Boolean(process.env.ADMIN_PASSWORD);
}

function sessionSecret() {
  return process.env.ADMIN_SESSION_SECRET || process.env.BOOKING_ACTION_SECRET || process.env.RESEND_API_KEY || "";
}

function base64url(input) {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function unbase64url(input) {
  const normalized = String(input || "").replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized + "=".repeat((4 - (normalized.length % 4)) % 4), "base64").toString("utf8");
}

function sign(body) {
  const secret = sessionSecret();
  if (!secret) throw new Error("Admin session secret is not configured");
  return crypto.createHmac("sha256", secret).update(body).digest("base64url");
}

function createAdminSession() {
  const now = Math.floor(Date.now() / 1000);
  const body = base64url(JSON.stringify({ v: 1, iat: now, exp: now + MAX_AGE_SECONDS }));
  return body + "." + sign(body);
}

function verifyAdminSession(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 2) return false;
  const [body, signature] = parts;
  const expected = sign(body);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  const payload = JSON.parse(unbase64url(body));
  return Boolean(payload.exp && payload.exp > Math.floor(Date.now() / 1000));
}

function parseCookies(req) {
  return String(req.headers.cookie || "")
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean)
    .reduce((acc, item) => {
      const eq = item.indexOf("=");
      if (eq === -1) return acc;
      acc[decodeURIComponent(item.slice(0, eq))] = decodeURIComponent(item.slice(eq + 1));
      return acc;
    }, {});
}

function isAuthenticated(req) {
  try {
    if (!sessionSecret()) return false;
    const cookies = parseCookies(req);
    return verifyAdminSession(cookies[COOKIE_NAME]);
  } catch (_) {
    return false;
  }
}

function createSignedState(payload) {
  const body = base64url(JSON.stringify({ v: 1, iat: Date.now(), payload: payload || {} }));
  return body + "." + sign(body);
}

function verifySignedState(token, maxAgeSeconds) {
  const parts = String(token || "").split(".");
  if (parts.length !== 2) throw new Error("Invalid state token");
  const [body, signature] = parts;
  const expected = sign(body);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new Error("Invalid state signature");
  }
  const parsed = JSON.parse(unbase64url(body));
  const ttl = Number(maxAgeSeconds || 600) * 1000;
  if (!parsed.iat || Date.now() - parsed.iat > ttl) {
    throw new Error("State token expired");
  }
  return parsed.payload || {};
}

function passwordMatches(input) {
  const expected = process.env.ADMIN_PASSWORD || "";
  const a = Buffer.from(String(input || ""));
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function cookie(value, maxAge) {
  return [
    COOKIE_NAME + "=" + encodeURIComponent(value),
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    "Max-Age=" + maxAge,
  ].join("; ");
}

function setSessionCookie(res, token) {
  res.setHeader("Set-Cookie", cookie(token, MAX_AGE_SECONDS));
}

function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", cookie("", 0));
}

function calendarConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REFRESH_TOKEN);
}

function calendarOAuthClientConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function adminStatus(req) {
  return {
    ok: true,
    configured: isAdminConfigured(),
    authenticated: isAuthenticated(req),
    features: {
      email: Boolean(process.env.RESEND_API_KEY),
      calendar: calendarConfigured(),
      calendarOAuthClient: calendarOAuthClientConfigured(),
      calendarId: process.env.GOOGLE_CALENDAR_ID || "primary",
      calendarAccount: process.env.GOOGLE_CALENDAR_EMAIL || "lablifehub@gmail.com",
    },
  };
}

module.exports = {
  adminStatus,
  clearSessionCookie,
  createAdminSession,
  createSignedState,
  isAdminConfigured,
  isAuthenticated,
  passwordMatches,
  setSessionCookie,
  verifySignedState,
};
