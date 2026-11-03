import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { listSellers, getSeller, createSeller } from "./lib/store.js";
import { answerFromKB } from "./lib/agent.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, "public");
const PORT = process.env.PORT || 3000;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function send(res, code, body, type = "application/json") {
  res.writeHead(code, { "content-type": type });
  res.end(typeof body === "string" ? body : JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function card(cardBase, s) {
  return {
    agentId: s.id,
    name: s.name,
    owner: s.owner,
    contact: s.contact,
    languages: s.languages,
    offerings: s.offerings,
    description: (s.kb || "").slice(0, 200),
    endpoint: `${cardBase}/api/card/${s.id}`,
    inquireUrl: `${cardBase}/api/sellers/${s.id}/inquire`,
    protocol: "agentic-b2b/0.1",
  };
}

const server = http.createServer(async (req, res) => {
  const base = `${req.headers["x-forwarded-proto"] || "http"}://${req.headers.host}`;
  const url = new URL(req.url, base);
  const p = url.pathname;

  // ---- API ----
  if (p === "/api/sellers" && req.method === "GET") {
    return send(res, 200, listSellers());
  }

  if (p === "/api/sellers" && req.method === "POST") {
    const body = await readBody(req);
    if (!body.name) return send(res, 400, { error: "name required" });
    const s = createSeller(body);
    return send(res, 201, { id: s.id, token: s.token, cardUrl: `${base}/api/card/${s.id}` });
  }

  const cardMatch = p.match(/^\/api\/card\/([\w]+)$/);
  if (cardMatch && req.method === "GET") {
    const s = getSeller(cardMatch[1]);
    if (!s) return send(res, 404, { error: "not found" });
    return send(res, 200, card(base, s));
  }

  const inqMatch = p.match(/^\/api\/sellers\/([\w]+)\/inquire$/);
  if (inqMatch && req.method === "POST") {
    const s = getSeller(inqMatch[1]);
    if (!s) return send(res, 404, { error: "not found" });
    const body = await readBody(req);
    const reply = await answerFromKB(s, s.kb, body.query || "", body.locale || "en");
    return send(res, 200, {
      from: s.id,
      to: body.from || "unknown",
      answer: reply.text,
      needsHuman: reply.needsHuman,
      sources: reply.sources,
    });
  }

  // ---- static ----
  let filePath = path.join(PUBLIC, p === "/" ? "index.html" : p);
  if (!filePath.startsWith(PUBLIC)) return send(res, 403, { error: "forbidden" });
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    // SPA fallback
    filePath = path.join(PUBLIC, "index.html");
  }
  const ext = path.extname(filePath);
  send(res, 200, fs.readFileSync(filePath), MIME[ext] || "application/octet-stream");
});

server.listen(PORT, () => {
  console.log(`[agentic-b2b-app] running on http://localhost:${PORT}`);
});
