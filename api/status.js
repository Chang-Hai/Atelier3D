const MESHY_BASE_URL = process.env.MESHY_BASE_URL || "https://api.meshy.ai/openapi/v1";
const { requireAuth } = require("../lib/auth");

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function normalizeStatus(status) {
  const value = String(status || "").toLowerCase();
  if (["succeeded", "success", "completed", "complete"].includes(value)) return "success";
  if (["failed", "failure", "error"].includes(value)) return "failed";
  if (["expired"].includes(value)) return "failed";
  if (["cancelled", "canceled"].includes(value)) return "cancelled";
  if (["pending", "in_progress", "running", "queued", "processing"].includes(value)) return "running";
  return value || "unknown";
}

function findOutput(payload) {
  const output = payload?.data || payload;
  const modelUrl =
    output?.model_urls?.glb ||
    output?.model_urls?.fbx ||
    output?.model_urls?.obj ||
    output?.model_url ||
    "";
  const renderedImage =
    output?.thumbnail_url ||
    output?.rendered_image?.url ||
    output?.rendered_image ||
    "";
  return { modelUrl, renderedImage };
}

function findErrorMessage(payload) {
  return (
    payload?.task_error?.message ||
    payload?.error?.message ||
    payload?.message ||
    "Meshy generation task failed."
  );
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return send(res, 405, { message: "Method not allowed." });
  }

  const session = requireAuth(req, res);
  if (!session) return;

  const apiKey = process.env.MESHY_API_KEY;
  if (!apiKey) return send(res, 400, { message: "MESHY_API_KEY is not configured." });

  const url = new URL(req.url, `https://${req.headers.host || "localhost"}`);
  const taskId = url.searchParams.get("taskId");
  if (!taskId) return send(res, 400, { message: "Missing taskId." });

  try {
    const response = await fetch(`${MESHY_BASE_URL}/image-to-3d/${encodeURIComponent(taskId)}`, {
      headers: { Authorization: `Bearer ${apiKey}` }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return send(res, response.status || 502, {
        message: payload.message || payload.error || "Meshy status check failed.",
        details: payload
      });
    }

    const rawStatus = payload?.status || payload?.data?.status;
    const status = normalizeStatus(rawStatus);
    const output = findOutput(payload);

    return send(res, 200, {
      status,
      modelUrl: output.modelUrl,
      renderedImage: output.renderedImage,
      progress: payload?.progress || payload?.data?.progress || 0,
      message: status === "failed" ? findErrorMessage(payload) : "",
      rawStatus
    });
  } catch (error) {
    return send(res, 500, {
      message: "Status request failed.",
      error: error.message
    });
  }
};
