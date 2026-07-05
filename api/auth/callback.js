const {
  clearOAuthState,
  getRequiredGoogleConfig,
  readOAuthState,
  redirect,
  sendJson,
  setSession
} = require("../../lib/auth");

async function exchangeCode({ code, config }) {
  const body = new URLSearchParams();
  body.set("code", code);
  body.set("client_id", config.clientId);
  body.set("client_secret", config.clientSecret);
  body.set("redirect_uri", config.redirectUri);
  body.set("grant_type", "authorization_code");

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload.error_description || payload.error || "Google token exchange failed.";
    throw new Error(message);
  }
  return payload;
}

async function fetchGoogleUser(accessToken) {
  const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error_description || payload.error || "Google user profile request failed.");
  if (!payload.sub || !payload.email) throw new Error("Google user profile is missing required identity fields.");
  return {
    sub: payload.sub,
    email: payload.email,
    emailVerified: Boolean(payload.email_verified),
    name: payload.name || payload.email,
    picture: payload.picture || ""
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { message: "Method not allowed." });
  }

  const config = getRequiredGoogleConfig(req);
  if (!config.ok) return sendJson(res, 500, config);

  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const error = url.searchParams.get("error");
  if (error) return sendJson(res, 400, { message: "Google sign-in was cancelled or denied.", error });

  const code = url.searchParams.get("code");
  const state = readOAuthState(req, url.searchParams.get("state"));
  clearOAuthState(res);
  if (!code || !state) return sendJson(res, 400, { message: "Invalid Google sign-in callback." });

  try {
    const tokenPayload = await exchangeCode({ code, config });
    const user = await fetchGoogleUser(tokenPayload.access_token);
    setSession(res, user);
    return redirect(res, state.returnTo || "/#generator");
  } catch (caught) {
    return sendJson(res, 502, {
      message: "Google sign-in failed.",
      error: caught.message
    });
  }
};
