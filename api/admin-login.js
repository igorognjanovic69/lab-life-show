const {
  adminStatus,
  createAdminSession,
  isAdminConfigured,
  passwordMatches,
  setSessionCookie,
} = require("./admin-utils");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  if (!isAdminConfigured()) {
    return res.status(503).json({ ok: false, error: "Admin password is not configured" });
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};
  if (!passwordMatches(body.password)) {
    return res.status(401).json({ ok: false, error: "Invalid password" });
  }

  setSessionCookie(res, createAdminSession());
  return res.status(200).json(adminStatus(req));
};
