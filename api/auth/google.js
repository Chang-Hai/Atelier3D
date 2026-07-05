const {
  createOAuthState,
  getRequiredGoogleConfig,
  normalizeReturnTo,
  redirect,
  sendJson
} = require("../../lib/auth");

module.exports = function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { message: "Method not allowed." });
  }

  const config = getRequiredGoogleConfig(req);
  if (!config.ok) return sendJson(res, 500, config);

  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const returnTo = normalizeReturnTo(url.searchParams.get("returnTo") || "/#generator");
  const state = createOAuthState(res, returnTo);
  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", config.clientId);
  authUrl.searchParams.set("redirect_uri", config.redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "openid email profile");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("access_type", "online");
  authUrl.searchParams.set("prompt", "select_account");

  return redirect(res, authUrl.toString());
};
