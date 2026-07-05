const TRIPO_BASE_URL = process.env.TRIPO_BASE_URL || "https://openapi.tripo3d.ai/v3";

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function normalizeStatus(status) {
  const value = String(status || "").toLowerCase();
  if (["success", "succeeded", "completed", "complete"].includes(value)) return "success";
  if (["failed", "failure", "error"].includes(value)) return "failed";
  if (["cancelled", "canceled"].includes(value)) return "cancelled";
  if (["banned"].includes(value)) return "banned";
  if (["running", "queued", "pending", "processing"].includes(value)) return "running";
  return value || "unknown";
}

function findOutput(payload) {
  const output = payload?.data?.output || payload?.output || payload?.data || payload;
  const modelUrl =
    output?.model_url ||
    output?.model ||
    output?.model_mesh?.url ||
    output?.pbr_model?.url ||
    output?.base_model?.url ||
    output?.result?.model ||
    "";
  const renderedImage =
    output?.rendered_image?.url ||
    output?.rendered_image ||
    output?.rendered_image_url ||
    output?.preview ||
    "";
  return { modelUrl, renderedImage };
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return send(res, 405, { message: "Method not allowed." });
  }

  const apiKey = process.env.TRIPO_API_KEY;
  if (!apiKey) return send(res, 400, { message: "TRIPO_API_KEY is not configured." });

  const url = new URL(req.url, `https://${req.headers.host || "localhost"}`);
  const taskId = url.searchParams.get("taskId");
  if (!taskId) return send(res, 400, { message: "Missing taskId." });

  try {
    const response = await fetch(`${TRIPO_BASE_URL}/tasks/${encodeURIComponent(taskId)}`, {
      headers: { Authorization: `Bearer ${apiKey}` }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.code !== 0) {
      return send(res, response.status, {
        message: payload.message || "Tripo status check failed.",
        suggestion: payload.suggestion,
        details: payload
      });
    }

    const rawStatus = payload?.data?.status || payload?.status;
    const status = normalizeStatus(rawStatus);
    const output = findOutput(payload);

    return send(res, 200, {
      status,
      modelUrl: output.modelUrl,
      renderedImage: output.renderedImage,
      rawStatus
    });
  } catch (error) {
    return send(res, 500, {
      message: "Status request failed.",
      error: error.message
    });
  }
};
