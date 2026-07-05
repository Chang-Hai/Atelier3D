const { clearSession, sendJson } = require("../../lib/auth");

module.exports = function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { message: "Method not allowed." });
  }

  clearSession(res);
  return sendJson(res, 200, { authenticated: false });
};
