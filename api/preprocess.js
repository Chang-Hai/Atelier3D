const ARK_IMAGE_URL = process.env.ARK_IMAGE_URL || "https://ark.cn-beijing.volces.com/api/v3/images/generations";
const { requireAuth } = require("../lib/auth");

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

function firstImageUrl(payload) {
  return (
    payload?.data?.[0]?.url ||
    payload?.data?.[0]?.b64_json ||
    payload?.data?.image_url ||
    payload?.url ||
    payload?.image_url ||
    ""
  );
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return send(res, 405, { message: "Method not allowed." });
  }

  const session = requireAuth(req, res);
  if (!session) return;

  const apiKey = process.env.ARK_API_KEY;
  if (!apiKey) {
    return send(res, 200, {
      mode: "skipped",
      message: "ARK_API_KEY is not configured. Preprocess skipped."
    });
  }

  try {
    const body = JSON.parse(await readBody(req) || "{}");
    if (!body.image || typeof body.image !== "string") {
      return send(res, 400, { message: "Missing image." });
    }
    if (body.image.length > 16 * 1024 * 1024) {
      return send(res, 413, { message: "Image payload is too large for preprocessing." });
    }

    const prompt = body.prompt || "Keep the main subject and remove the background for 3D model generation.";
    const response = await fetch(ARK_IMAGE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: process.env.ARK_IMAGE_MODEL || "doubao-seedream-5-0-260128",
        prompt,
        image: body.image,
        sequential_image_generation: "disabled",
        response_format: "url",
        size: process.env.ARK_IMAGE_SIZE || "2K",
        stream: false,
        watermark: false
      })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.error) {
      return send(res, response.ok ? 502 : response.status, {
        message: payload?.error?.message || payload.message || "Ark image preprocessing failed.",
        details: payload
      });
    }

    const image = firstImageUrl(payload);
    if (!image) {
      return send(res, 502, {
        message: "Ark preprocessing did not return an image URL.",
        details: payload
      });
    }

    return send(res, 200, {
      image,
      imageUrl: image,
      provider: "volcengine-ark"
    });
  } catch (error) {
    return send(res, 500, {
      message: "Preprocess request failed.",
      error: error.message
    });
  }
};
