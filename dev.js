// Local stand-in for Vercel: serves public/ and api/ with the same security headers.
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { Readable } from "node:stream";
import { pathToFileURL } from "node:url";
import { parseEnv } from "node:util";

// .env.local wins over variables saved on this computer, so an old key there can't replace yours.
if (existsSync(".env.local")) Object.assign(process.env, parseEnv(readFileSync(".env.local", "utf8")));

const root = resolve("public");
const port = Number(process.env.PORT) || 3000;
const headers = JSON.parse(readFileSync("vercel.json", "utf8")).headers[0].headers;
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript", ".svg": "image/svg+xml", ".mp4": "video/mp4", ".jpg": "image/jpeg", ".png": "image/png" };

createServer(async (req, res) => {
  for (const { key, value } of headers) res.setHeader(key, value);
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname.startsWith("/api/")) {
    const file = resolve("api", `${url.pathname.slice(5)}.js`);
    if (!existsSync(file)) return res.writeHead(404).end();
    const handler = (await import(pathToFileURL(file).href))[req.method];
    if (!handler) return res.writeHead(405).end();
    const hasBody = req.method !== "GET" && req.method !== "HEAD";
    const request = new Request(url, {
      method: req.method,
      headers: { ...req.headers, "x-forwarded-for": req.socket.remoteAddress },
      ...(hasBody ? { body: Readable.toWeb(req), duplex: "half" } : {}),
    });
    const response = await handler(request);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    if (!response.body) return res.end();
    const body = Readable.fromWeb(response.body);
    res.on("close", () => body.destroy());
    return body.pipe(res);
  }

  const path = url.pathname === "/" ? "/index.html" : url.pathname;
  const file = join(root, normalize(decodeURIComponent(extname(path) ? path : `${path}.html`)));
  if (!file.startsWith(root) || !existsSync(file) || !statSync(file).isFile()) return res.writeHead(404).end("Not found");
  res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" });
  createReadStream(file).pipe(res);
}).listen(port, () => console.log(`RoleHint is running at http://localhost:${port}`));
