// Protects admin-only routes with a shared secret key.
// The admin panel sends it as the  x-admin-key  header.
function adminAuth(req, res, next) {
  const key = req.header("x-admin-key");
  if (!process.env.ADMIN_API_KEY) {
    return res.status(500).json({ error: "Server misconfigured: ADMIN_API_KEY is not set." });
  }
  if (!key || key !== process.env.ADMIN_API_KEY) {
    return res.status(401).json({ error: "Invalid or missing admin key." });
  }
  next();
}

module.exports = adminAuth;
