const http = require("http");
const fs = require("fs");
const path = require("path");

loadLocalEnv();

const generate = require("./api/generate");
const status = require("./api/status");
const config = require("./api/config");
const preprocess = require("./api/preprocess");
const authGoogle = require("./api/auth/google");
const authCallback = require("./api/auth/callback");
const authSession = require("./api/auth/session");
const authLogout = require("./api/auth/logout");

const root = __dirname;
const port = Number(process.env.PORT || 3000);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml"
};

const server = http.createServer(async (req, res) => {
  try {
    if (req.url.startsWith("/api/generate")) return generate(req, res);
    if (req.url.startsWith("/api/status")) return status(req, res);
    if (req.url.startsWith("/api/config")) return config(req, res);
    if (req.url.startsWith("/api/preprocess")) return preprocess(req, res);
    if (req.url.startsWith("/api/auth/google")) return authGoogle(req, res);
    if (req.url.startsWith("/api/auth/callback")) return authCallback(req, res);
    if (req.url.startsWith("/api/auth/session")) return authSession(req, res);
    if (req.url.startsWith("/api/auth/logout")) return authLogout(req, res);

    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const requested = url.pathname === "/" ? "/index.html" : url.pathname;
    const filePath = path.normalize(path.join(root, requested));

    if (!filePath.startsWith(root)) {
      res.writeHead(403);
      return res.end("Forbidden");
    }

    fs.readFile(filePath, (error, content) => {
      if (error) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        return res.end("Not found");
      }
      res.writeHead(200, { "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream" });
      res.end(content);
    });
  } catch (error) {
    res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ message: "Local server error.", error: error.message }));
  }
});

server.listen(port, () => {
  console.log(`Local dev server running at http://localhost:${port}`);
});

function loadLocalEnv() {
  for (const fileName of [".env.local", ".env"]) {
    const filePath = path.join(__dirname, fileName);
    if (!fs.existsSync(filePath)) continue;

    const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const index = trimmed.indexOf("=");
      if (index === -1) continue;

      const key = trimmed.slice(0, index).trim();
      const rawValue = trimmed.slice(index + 1).trim();
      const value = rawValue.replace(/^["']|["']$/g, "");
      if (key && process.env[key] === undefined) process.env[key] = value;
    }
  }
}
