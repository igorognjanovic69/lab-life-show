const { createSignedState, isAuthenticated } = require("../lib/admin-utils.cjs");
const { getBaseUrl, esc } = require("../lib/booking-utils.cjs");

const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar";

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  if (!isAuthenticated(req)) {
    return sendHtml(res, 401, page("Admin login required", "Please log in to the LabLifeHub admin page before connecting Google Calendar."));
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return sendHtml(
      res,
      503,
      page(
        "Google OAuth is not configured",
        "Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Vercel Production environment variables, redeploy, then open this page again."
      )
    );
  }

  const redirectUri = new URL("/api/google-oauth-callback", getBaseUrl(req)).href;
  const state = createSignedState({ redirectUri });
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: CALENDAR_SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });

  res.status(302);
  res.setHeader("Location", "https://accounts.google.com/o/oauth2/v2/auth?" + params.toString());
  return res.end();
};

function sendHtml(res, status, html) {
  res.status(status);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  return res.end(html);
}

function page(title, message) {
  return (
    '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="robots" content="noindex,nofollow"><title>' +
    esc(title) +
    ' - LabLifeHub</title><style>body{font-family:Arial,sans-serif;background:#f3f5f4;color:#26302e;padding:28px}main{max-width:720px;margin:auto;background:#fff;border:1px solid #e5e7eb;border-radius:24px;padding:24px;box-shadow:0 18px 45px rgba(38,48,46,.08)}a{color:#179389;font-weight:700}</style></head><body><main><h1>' +
    esc(title) +
    "</h1><p>" +
    esc(message) +
    '</p><p><a href="/admin/">Back to admin</a></p></main></body></html>'
  );
}
