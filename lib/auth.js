const crypto = require("crypto");

const SESSION_COOKIE = "atelier3d_session";
const STATE_COOKIE = "atelier3d_oauth_state";
const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
const STATE_MAX_AGE_SECONDS = 10 * 60;

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function getAuthSecret() {
  return process.env.AUTH_SECRET || process.env.SESSION_SECRET || process.env.GOOGLE_CLIENT_SECRET || "";
}

function getRequiredGoogleConfig(req) {
  const clientId = process.env.GOOGLE_CLIENT_ID || "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
  const authSecret = getAuthSecret();
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${getOrigin(req)}/api/auth/callback`;

  if (!clientId || !clientSecret || !authSecret) {
    return {
      ok: false,
      message: "Google auth is not configured.",
      missing: {
        GOOGLE_CLIENT_ID: !clientId,
        GOOGLE_CLIENT_SECRET: !clientSecret,
        AUTH_SECRET: !authSecret
      }
    };
  }

  return { ok: true, clientId, clientSecret, authSecret, redirectUri };
}

function getOrigin(req) {
  const proto = req.headers["x-forwarded-proto"] || (req.socket?.encrypted ? "https" : "http");
  const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost:3000";
  return `${String(proto).split(",")[0]}://${String(host).split(",")[0]}`;
}

function parseCookies(req) {
  const header = req.headers.cookie || "";
  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        if (index === -1) return [part, ""];
        try {
          return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
        } catch {
          return [part.slice(0, index), ""];
        }
      })
  );
}

function appendSetCookie(res, cookie) {
  const current = res.getHeader("Set-Cookie");
  if (!current) return res.setHeader("Set-Cookie", cookie);
  if (Array.isArray(current)) return res.setHeader("Set-Cookie", [...current, cookie]);
  return res.setHeader("Set-Cookie", [current, cookie]);
}

function buildCookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, "Path=/", "HttpOnly", "SameSite=Lax"];
  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
  if (options.expires) parts.push(`Expires=${options.expires.toUTCString()}`);
  if (process.env.NODE_ENV === "production" || process.env.VERCEL) parts.push("Secure");
  return parts.join("; ");
}

function clearCookie(res, name) {
  appendSetCookie(res, buildCookie(name, "", { maxAge: 0, expires: new Date(0) }));
}

function base64url(input) {
  return Buffer.from(input).toString("base64url");
}

function sign(value, secret) {
  return crypto.createHmac("sha256", secret).update(value).digest("base64url");
}

function timingSafeEqual(a, b) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function createSessionCookie(user) {
  const secret = getAuthSecret();
  if (!secret) throw new Error("AUTH_SECRET is not configured.");

  const issuedAt = Math.floor(Date.now() / 1000);
  const payload = {
    sub: user.sub,
    email: user.email,
    emailVerified: Boolean(user.emailVerified),
    name: user.name || "",
    picture: user.picture || "",
    iat: issuedAt,
    exp: issuedAt + SESSION_MAX_AGE_SECONDS
  };
  const encoded = base64url(JSON.stringify(payload));
  return `${encoded}.${sign(encoded, secret)}`;
}

function readSession(req) {
  const secret = getAuthSecret();
  if (!secret) return null;

  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token || !token.includes(".")) return null;

  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;
  if (!timingSafeEqual(signature, sign(encoded, secret))) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return {
      user: {
        id: payload.sub,
        sub: payload.sub,
        email: payload.email,
        emailVerified: Boolean(payload.emailVerified),
        name: payload.name,
        picture: payload.picture
      },
      expiresAt: payload.exp
    };
  } catch {
    return null;
  }
}

function setSession(res, user) {
  appendSetCookie(res, buildCookie(SESSION_COOKIE, createSessionCookie(user), { maxAge: SESSION_MAX_AGE_SECONDS }));
}

function clearSession(res) {
  clearCookie(res, SESSION_COOKIE);
}

function requireAuth(req, res) {
  const session = readSession(req);
  if (session) return session;
  sendJson(res, 401, {
    message: "Authentication required.",
    loginUrl: "/api/auth/google"
  });
  return null;
}

function createOAuthState(res, returnTo = "/") {
  const nonce = crypto.randomBytes(24).toString("base64url");
  appendSetCookie(res, buildCookie(STATE_COOKIE, nonce, { maxAge: STATE_MAX_AGE_SECONDS }));
  return base64url(JSON.stringify({ nonce, returnTo: normalizeReturnTo(returnTo) }));
}

function readOAuthState(req, state) {
  const expectedNonce = parseCookies(req)[STATE_COOKIE];
  if (!expectedNonce || !state) return null;
  try {
    const payload = JSON.parse(Buffer.from(state, "base64url").toString("utf8"));
    if (!payload.nonce || !timingSafeEqual(payload.nonce, expectedNonce)) return null;
    return { returnTo: normalizeReturnTo(payload.returnTo) };
  } catch {
    return null;
  }
}

function clearOAuthState(res) {
  clearCookie(res, STATE_COOKIE);
}

function normalizeReturnTo(value) {
  const fallback = "/";
  if (!value || typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}

function redirect(res, location, status = 302) {
  res.statusCode = status;
  res.setHeader("Location", location);
  res.end();
}

module.exports = {
  SESSION_COOKIE,
  sendJson,
  getRequiredGoogleConfig,
  getOrigin,
  readSession,
  requireAuth,
  setSession,
  clearSession,
  createOAuthState,
  readOAuthState,
  clearOAuthState,
  normalizeReturnTo,
  redirect
};
