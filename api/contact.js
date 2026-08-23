// Vercel Serverless Function - receives a general contact message and emails
// it to Dr. Jeremić via Resend (https://resend.com, free tier is enough).
//
// Uses the same environment variables as /api/book.js:
//   RESEND_API_KEY     = your Resend API key
//   BOOKING_FROM_EMAIL = optional verified sender, defaults to LabLifeHub <nevenajeremic@lablifehub.com>
//
// Until RESEND_API_KEY is set, the function returns { ok:true, configured:false }
// and the site shows a local confirmation instead.
//
// Contact messages are always delivered to nevenajeremic@lablifehub.com.

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
  const type = clean(body.type, 100);
  const name = clean(body.name, 200);
  const email = clean(body.email, 200);
  const phone = clean(body.phone, 100);
  const subject = clean(body.subject, 200);
  const message = clean(body.message, 6000);
  const website = clean(body.website, 300);
  const isPodcastGuest = type === "podcastGuest";
  const guest = body.guest && typeof body.guest === "object" ? body.guest : {};

  // Honeypot: bots often complete hidden fields.
  if (website) {
    return res.status(200).json({ ok: true, configured: Boolean(key) });
  }

  if (isPodcastGuest) {
    const title = clean(guest.title, 300);
    const affiliation = clean(guest.affiliation, 300);
    const location = clean(guest.location, 200);
    const previous = clean(guest.previous, 2000);
    const expertise = clean(guest.expertise, 2000);
    const topic = clean(guest.topic, 2000);
    const why = clean(guest.why, 2500);
    const bio = clean(guest.bio, 3000);
    const publications = clean(guest.publications, 2500);
    const links = clean(guest.links, 2500);
    const notes = clean(guest.notes, 2000);
    const consent = guest.consent === true;

    if (!name || !email || !phone || !title || !affiliation || !expertise || !topic || !why || !bio || !consent) {
      return res.status(400).json({ ok: false, error: "Missing required fields" });
    }

    if (!key) {
      return res.status(200).json({ ok: true, configured: false });
    }

    const html =
      "<h2>New LabLifePodcast guest application</h2>" +
      detail("Name", name) +
      detail("Email", email) +
      detail("Phone", phone) +
      detail("Title / professional role", title) +
      detail("Current institution / company", affiliation) +
      detail("City / country", location) +
      block("Previous institutions, labs, companies or relevant work", previous) +
      block("Field of expertise", expertise) +
      block("Proposed podcast topic or story", topic) +
      block("Why they would like to participate", why) +
      block("Short professional biography", bio) +
      block("Selected papers / publications / projects", publications) +
      block("Useful links", links) +
      block("Additional notes", notes) +
      detail("Contact consent", "Yes");

    return sendContactEmail({
      res,
      key,
      from,
      to,
      email,
      subject: "Podcast guest application - " + name,
      html,
    });
  }

  if (!name || !email || !phone || !message) {
    return res.status(400).json({ ok: false, error: "Missing required fields" });
  }

  if (!key) {
    return res.status(200).json({ ok: true, configured: false });
  }

  const mailSubject = subject ? "Contact: " + subject : "New contact message - LabLifeHub";
  const html =
    "<h2>New message - LabLifeHub</h2>" +
    detail("Name", name) +
    detail("Email", email) +
    detail("Phone", phone) +
    detail("Subject", subject) +
    block("Message", message);

  return sendContactEmail({ res, key, from, to, email, subject: mailSubject, html });
};

async function sendContactEmail({ res, key, from, to, email, subject, html }) {
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
}

function clean(value, max) {
  return (value || "").toString().trim().slice(0, max);
}

function detail(label, value) {
  return "<p><strong>" + esc(label) + ":</strong> " + (esc(value) || "-") + "</p>";
}

function block(label, value) {
  return "<p><strong>" + esc(label) + ":</strong><br/>" + (esc(value).replace(/\n/g, "<br/>") || "-") + "</p>";
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}
