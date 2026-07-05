const MESHY_BASE_URL = process.env.MESHY_BASE_URL || "https://api.meshy.ai/openapi/v1";
const { requireAuth } = require("../lib/auth");
const dailyUsage = globalThis.__atelierDailyUsage || new Map();
globalThis.__atelierDailyUsage = dailyUsage;

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function parseDataUrl(dataUrl) {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl || "");
  if (!match) return null;
  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], "base64")
  };
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

function findTaskId(taskPayload) {
  return taskPayload?.result || taskPayload?.id || taskPayload?.task_id || taskPayload?.data?.id;
}

async function verifyTurnstile(token, req) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return { ok: true, skipped: true };
  if (!token) return { ok: false, message: "Turnstile verification is required." };

  const formData = new URLSearchParams();
  formData.append("secret", secret);
  formData.append("response", token);
  const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim();
  if (ip) formData.append("remoteip", ip);

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formData
  });
  const payload = await response.json().catch(() => ({}));
  return { ok: Boolean(payload.success), message: "Turnstile verification failed.", details: payload };
}

function getClientId(req) {
  const session = req.session;
  if (session?.user?.id) return `user:${session.user.id}`;
  return (
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.headers["x-real-ip"] ||
    req.socket?.remoteAddress ||
    "unknown"
  );
}

function checkDailyLimit(req) {
  const limit = Number(process.env.FREE_DAILY_LIMIT || 1);
  if (!Number.isFinite(limit) || limit <= 0) return { ok: true };

  const date = new Date().toISOString().slice(0, 10);
  const key = `${date}:${getClientId(req)}`;
  const used = dailyUsage.get(key) || 0;
  if (used >= limit) {
    return {
      ok: false,
      message: "Daily free generation limit reached.",
      suggestion: "Come back tomorrow or upgrade for more generations."
    };
  }
  dailyUsage.set(key, used + 1);
  return { ok: true, remaining: Math.max(0, limit - used - 1) };
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return send(res, 405, { message: "Method not allowed." });
  }

  const session = requireAuth(req, res);
  if (!session) return;
  req.session = session;

  const apiKey = process.env.MESHY_API_KEY;
  if (!apiKey) {
    return send(res, 200, {
      mode: "demo",
      message: "MESHY_API_KEY is not configured. The frontend will use local demo preview."
    });
  }

  try {
    const raw = await readBody(req);
    const body = JSON.parse(raw || "{}");
    const turnstile = await verifyTurnstile(body.turnstileToken, req);
    if (!turnstile.ok) return send(res, 403, turnstile);

    const parsed = parseDataUrl(body.image);
    if (!parsed && !isHttpUrl(body.image)) return send(res, 400, { message: "Invalid image data." });
    if (parsed?.buffer.length > 10 * 1024 * 1024) return send(res, 413, { message: "Image must be smaller than 10MB." });

    const quota = checkDailyLimit(req);
    if (!quota.ok) return send(res, 429, quota);

    const taskResponse = await fetch(`${MESHY_BASE_URL}/image-to-3d`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        image_url: body.image,
        ai_model: process.env.MESHY_AI_MODEL || "meshy-5",
        topology: process.env.MESHY_TOPOLOGY || "triangle",
        target_polycount: Number(process.env.MESHY_TARGET_POLYCOUNT || 30000),
        should_remesh: process.env.MESHY_SHOULD_REMESH !== "false",
        should_texture: process.env.MESHY_SHOULD_TEXTURE !== "false",
        enable_pbr: process.env.MESHY_ENABLE_PBR !== "false"
      })
    });
    const taskPayload = await taskResponse.json().catch(() => ({}));
    if (!taskResponse.ok) {
      return send(res, taskResponse.status || 502, {
        message: taskPayload.message || taskPayload.error || "Meshy task creation failed.",
        details: taskPayload
      });
    }

    const taskId = findTaskId(taskPayload);
    if (!taskId) {
      return send(res, 502, {
        message: "Meshy task response did not include a task id.",
        details: taskPayload
      });
    }

    return send(res, 200, { taskId });
  } catch (error) {
    return send(res, 500, {
      message: "Generation request failed.",
      error: error.message
    });
  }
};
