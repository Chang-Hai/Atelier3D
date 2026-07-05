const http = require("http");
const fs = require("fs");
const path = require("path");

const generate = require("./api/generate");
const status = require("./api/status");
const config = require("./api/config");
const preprocess = require("./api/preprocess");

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
