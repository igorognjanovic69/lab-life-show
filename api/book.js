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

const SITE_EMAIL = "nevenajeremic@lablifehub.com";
const DEFAULT_FROM_EMAIL = "LabLifeHub <nevenajeremic@lablifehub.com>";

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const key = process.env.RESEND_API_KEY;
  const to = SITE_EMAIL;
  const from = (process.env.BOOKING_FROM_EMAIL || DEFAULT_FROM_EMAIL).trim();

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const service = (body.service || "").toString().slice(0, 200);
  const name = (body.name || "").toString().slice(0, 200);
  const email = (body.email || "").toString().slice(0, 200);
  const phone = (body.phone || "").toString().slice(0, 100);
  const date = (body.date || "").toString().slice(0, 100);
  const message = (body.message || "").toString().slice(0, 4000);

  if (!name || !email || !phone || !service) {
    return res.status(400).json({ ok: false, error: "Missing required fields" });
  }

  // Not configured yet - let the front-end show its local confirmation.
  if (!key) {
    return res.status(200).json({ ok: true, configured: false });
  }

  const subject = "New booking request: " + service;
  const html =
    "<h2>New booking request - LabLifeAcademy</h2>" +
    "<p><strong>Service:</strong> " + esc(service) + "</p>" +
    "<p><strong>Name:</strong> " + esc(name) + "</p>" +
    "<p><strong>Email:</strong> " + esc(email) + "</p>" +
    "<p><strong>Phone:</strong> " + (esc(phone) || "-") + "</p>" +
    "<p><strong>Preferred date:</strong> " + (esc(date) || "-") + "</p>" +
    "<p><strong>Message:</strong><br/>" +
    (esc(message).replace(/\n/g, "<br/>") || "-") + "</p>";

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: email,
        subject,
        html,
      }),
    });

    if (!r.ok) {
      const detail = await r.text();
      return res.status(502).json({ ok: false, error: "Email provider error", detail });
    }
    return res.status(200).json({ ok: true, configured: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
};

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}
