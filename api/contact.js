// Vercel Serverless Function — receives a general contact message and emails
// it to Dr. Jeremić via Resend (https://resend.com, free tier is enough).
//
// Uses the same environment variables as /api/book.js:
//   RESEND_API_KEY     = your Resend API key
//   BOOKING_TO_EMAIL   = where messages are delivered (her inbox)
//   BOOKING_FROM_EMAIL = a verified sender, e.g. "Lab Life Show <hello@yourdomain.com>"
//
// Until these are set, the function returns { ok:true, configured:false }
// and the site shows a local confirmation instead.

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const key = process.env.RESEND_API_KEY;
  const to = process.env.BOOKING_TO_EMAIL;
  const from = process.env.BOOKING_FROM_EMAIL;

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const name = (body.name || "").toString().slice(0, 200);
  const email = (body.email || "").toString().slice(0, 200);
  const phone = (body.phone || "").toString().slice(0, 100);
  const subject = (body.subject || "").toString().slice(0, 200);
  const message = (body.message || "").toString().slice(0, 4000);

  if (!name || !email || !phone || !message) {
    return res.status(400).json({ ok: false, error: "Missing required fields" });
  }

  if (!key || !to || !from) {
    return res.status(200).json({ ok: true, configured: false });
  }

  const mailSubject = subject ? "Contact: " + subject : "New contact message — Lab Life Show";
  const html =
    "<h2>New message — Lab Life Show</h2>" +
    "<p><strong>Name:</strong> " + esc(name) + "</p>" +
    "<p><strong>Email:</strong> " + esc(email) + "</p>" +
    "<p><strong>Phone:</strong> " + (esc(phone) || "—") + "</p>" +
    "<p><strong>Subject:</strong> " + (esc(subject) || "—") + "</p>" +
    "<p><strong>Message:</strong><br/>" +
    (esc(message).replace(/\n/g, "<br/>") || "—") + "</p>";

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
        subject: mailSubject,
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
