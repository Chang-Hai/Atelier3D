const { readSession, sendJson } = require("../../lib/auth");

module.exports = function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { message: "Method not allowed." });
  }

  const session = readSession(req);
  res.setHeader("Cache-Control", "no-store");
  return sendJson(res, 200, {
    authenticated: Boolean(session),
    user: session?.user || null,
    expiresAt: session?.expiresAt || null
  });
};
