const { isAuthenticated, verifySignedState } = require("./admin-utils");
const { esc } = require("./booking-utils");

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    if (!isAuthenticated(req)) {
      return sendHtml(res, 401, page("Admin login required", errorBox("Please log in to the LabLifeHub admin page, then start the Google Calendar connection again.")));
    }

    const url = new URL(req.url, "https://lablifehub.com");
    const error = url.searchParams.get("error");
    if (error) {
      return sendHtml(res, 400, page("Google Calendar connection cancelled", errorBox(error)));
    }

    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code || !state) {
      return sendHtml(res, 400, page("Missing Google OAuth data", errorBox("Google did not return a valid authorization code.")));
    }

    const statePayload = verifySignedState(state, 600);
    const redirectUri = statePayload.redirectUri || "https://lablifehub.com/api/google-oauth-callback";
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID || "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }).toString(),
    });

    const tokenText = await tokenResponse.text();
    let tokenData = {};
    try {
      tokenData = JSON.parse(tokenText);
    } catch (_) {}

    if (!tokenResponse.ok) {
      return sendHtml(res, 502, page("Google token error", errorBox(tokenText || "Google token exchange failed.")));
    }

    if (!tokenData.refresh_token) {
      return sendHtml(
        res,
        200,
        page(
          "Refresh token not returned",
          errorBox("Google did not return a refresh token. Open /api/google-oauth-start again from the admin page, make sure you choose lablifehub@gmail.com, and approve access. If it still happens, revoke the app access in Google Account settings and connect again.")
        )
      );
    }

    return sendHtml(
      res,
      200,
      page(
        "Google Calendar token generated",
        successBox("Copy this value into Vercel as GOOGLE_REFRESH_TOKEN, then redeploy Production.") +
          '<label for="token">GOOGLE_REFRESH_TOKEN</label>' +
          '<textarea id="token" readonly onclick="this.select()">' +
          esc(tokenData.refresh_token) +
          "</textarea>" +
          '<div class="copy-row"><button type="button" onclick="navigator.clipboard.writeText(document.getElementById(\'token\').value).then(()=>this.textContent=\'Copied\')">Copy token</button><a href="/admin/">Back to admin</a></div>' +
          '<div class="next"><p><strong>Also set:</strong></p><ul><li>GOOGLE_CALENDAR_ID = primary</li><li>GOOGLE_CALENDAR_EMAIL = lablifehub@gmail.com</li></ul></div>'
      )
    );
  } catch (e) {
    return sendHtml(res, 500, page("Google Calendar connection error", errorBox(e.message || String(e))));
  }
};

function sendHtml(res, status, html) {
  res.status(status);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  return res.end(html);
}

function page(title, content) {
  return (
    '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="robots" content="noindex,nofollow"><title>' +
    esc(title) +
    ' - LabLifeHub</title><style>body{font-family:Arial,sans-serif;background:#f3f5f4;color:#26302e;padding:28px}main{max-width:820px;margin:auto;background:#fff;border:1px solid #e5e7eb;border-radius:24px;padding:24px;box-shadow:0 18px 45px rgba(38,48,46,.08)}p{line-height:1.55}.box{border:1px solid #e5e7eb;border-radius:18px;padding:16px;background:#f8faf9;margin:16px 0}.success{border-color:#b7d63d}.error{border-color:#ef4444}textarea{width:100%;min-height:140px;border:1px solid #d1d5db;border-radius:14px;padding:14px;font:14px monospace;box-sizing:border-box}label{display:block;font-weight:800;margin:16px 0 8px}button,a{display:inline-flex;margin:14px 10px 0 0;align-items:center;border:0;border-radius:999px;background:#179389;color:white;padding:12px 16px;font-weight:800;text-decoration:none;cursor:pointer}.copy-row a{background:white;color:#26302e;border:1px solid #d1d5db}.next{background:#f8faf9;border-radius:18px;padding:16px;margin-top:18px}</style></head><body><main><h1>' +
    esc(title) +
    "</h1>" +
    content +
    "</main></body></html>"
  );
}

function successBox(message) {
  return '<div class="box success"><p>' + esc(message) + "</p></div>";
}

function errorBox(message) {
  return '<div class="box error"><p>' + esc(message) + "</p></div>";
}
