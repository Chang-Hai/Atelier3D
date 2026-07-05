function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

module.exports = function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return send(res, 405, { message: "Method not allowed." });
  }

  return send(res, 200, {
    turnstileSiteKey: process.env.TURNSTILE_SITE_KEY || "",
    preprocessEnabled: Boolean(process.env.ARK_API_KEY),
    googleAuthEnabled: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
  });
};
