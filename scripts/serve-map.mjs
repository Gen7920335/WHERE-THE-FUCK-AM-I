import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve(import.meta.dirname, "../eft-where-am-i/html");
const port = Number(process.argv[2]) || 8765;
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, `http://${request.headers.host}`).pathname);
  const relative = normalize(pathname === "/" ? "map.html" : pathname.replace(/^\/+/, ""));
  const filePath = join(root, relative);
  if (!filePath.startsWith(root) || !statSafe(filePath)) {
    response.writeHead(404).end("Not found");
    return;
  }
  response.writeHead(200, { "Content-Type": mimeTypes[extname(filePath)] || "application/octet-stream" });
  createReadStream(filePath).pipe(response);
}).listen(port, "127.0.0.1", () => console.log(`Map test server: http://127.0.0.1:${port}/map.html`));

function statSafe(path) {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}
