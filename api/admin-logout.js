const { clearSessionCookie } = require("./admin-utils");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  clearSessionCookie(res);
  return res.status(200).json({ ok: true });
};
