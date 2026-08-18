// Vercel Serverless Function — receives a testimonial for moderation.
// It uses the same Resend environment variables as the booking/contact forms.
// Reviews are emailed to Dr. Jeremić and are never published automatically.

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const key = process.env.RESEND_API_KEY;
  const to = process.env.BOOKING_TO_EMAIL;
  const from = process.env.BOOKING_FROM_EMAIL;
  const body = req.body && typeof req.body === "object" ? req.body : {};

  // Honeypot: bots often complete hidden fields.
  if ((body.website || "").toString()) {
    return res.status(200).json({ ok: true, configured: Boolean(key && to && from) });
  }

  const name = clean(body.name, 200);
  const email = clean(body.email, 200);
  const role = clean(body.role, 250);
  const relationship = clean(body.relationship, 250);
  const review = clean(body.review, 2000);
  const consent = body.consent === true;

  if (!name || !email || !role || !review || !consent) {
    return res.status(400).json({ ok: false, error: "Missing required fields" });
  }

  if (!key || !to || !from) {
    return res.status(200).json({ ok: true, configured: false });
  }

  const html =
    "<h2>New testimonial for approval — LabLifeHub</h2>" +
    "<p><strong>Name:</strong> " + esc(name) + "</p>" +
    "<p><strong>Email (private):</strong> " + esc(email) + "</p>" +
    "<p><strong>Role / institution:</strong> " + esc(role) + "</p>" +
    "<p><strong>Collaboration context:</strong> " + (esc(relationship) || "—") + "</p>" +
    "<p><strong>Review:</strong><br/>" + esc(review).replace(/\n/g, "<br/>") + "</p>" +
    "<p><strong>Publishing consent:</strong> Yes — after editorial approval.</p>";

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
        subject: "New testimonial for approval — " + name,
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

function clean(value, max) {
  return (value || "").toString().trim().slice(0, max);
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}
