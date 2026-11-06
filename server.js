import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Minimal .env loader (no deps). Reads KEY=VALUE lines if .env exists.
try {
  const envPath = path.join(path.dirname(fileURLToPath(import.meta.url)), ".env");
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
      const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
} catch {}
import {
  listSellers,
  getSeller,
  createSeller,
  updateSeller,
  deleteSeller,
  deleteAll,
  seedIfEmpty,
} from "./lib/store.js";
import { answerFromKB } from "./lib/agent.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, "public");
const PORT = process.env.PORT || 3000;
const INVITE_CODES = (process.env.INVITE_CODES || "chinaselection")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
};

function send(res, code, body, type = "application/json") {
  res.writeHead(code, {
    "content-type": type,
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
  });
  if (Buffer.isBuffer(body)) return res.end(body);
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

  // Seller directory (public)
  if (p === "/api/sellers" && req.method === "GET") {
    return send(res, 200, listSellers());
  }

  // Register a seller — gated by phone + invite code
  if (p === "/api/sellers" && req.method === "POST") {
    const body = await readBody(req);
    if (!body.name) return send(res, 400, { error: "请填写智能体名称" });
    const phone = String(body.phone || "").trim();
    if (!/^1[3-9]\d{9}$/.test(phone)) return send(res, 400, { error: "请输入有效的手机号" });
    const code = String(body.inviteCode || "").trim();
    if (!INVITE_CODES.includes(code)) return send(res, 400, { error: "邀请码不正确" });
    const s = createSeller(body);
    return send(res, 201, {
      id: s.id,
      token: s.token,
      name: s.name,
      cardUrl: `${base}/api/card/${s.id}`,
    });
  }

  // Admin: clear all sellers (demo reset) — protected by ADMIN_KEY
  if (p === "/api/sellers" && req.method === "DELETE") {
    const r = deleteAll(url.searchParams.get("key") || "");
    if (r.error) return send(res, 403, r);
    return send(res, 200, r);
  }

  // Admin: seed demo sellers — protected by ADMIN_KEY
  if (p === "/api/admin/seed" && req.method === "POST") {
    if (url.searchParams.get("key") !== process.env.ADMIN_KEY) return send(res, 403, { error: "forbidden" });
    const n = seedIfEmpty();
    return send(res, 200, { seeded: n });
  }

  // Single seller: GET (public or full w/ token), PUT (update), DELETE (remove)
  const single = p.match(/^\/api\/sellers\/([\w]+)$/);
  if (single) {
    const s = getSeller(single[1]);
    if (!s) return send(res, 404, { error: "not found" });
    if (req.method === "GET") {
      const token = url.searchParams.get("token") || "";
      if (token && token === s.token) return send(res, 200, s); // full incl. kb
      const { kb, token: t, ...pub } = s;
      return send(res, 200, pub);
    }
    if (req.method === "PUT") {
      const body = await readBody(req);
      const token = body.token || url.searchParams.get("token") || "";
      const r = updateSeller(single[1], token, body);
      if (r.error === "forbidden") return send(res, 403, r);
      if (r.error) return send(res, 404, r);
      return send(res, 200, { id: r.seller.id, name: r.seller.name, cardUrl: `${base}/api/card/${r.seller.id}` });
    }
    if (req.method === "DELETE") {
      const body = await readBody(req);
      const token = body.token || url.searchParams.get("token") || "";
      const r = deleteSeller(single[1], token);
      if (r.error === "forbidden") return send(res, 403, r);
      if (r.error) return send(res, 404, r);
      return send(res, 200, r);
    }
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

  // Machine-readable product catalog (GEO for external buyer agents)
  if (p === "/api/catalog.json" && req.method === "GET") {
    const p2 = path.join(PUBLIC, "catalog.json");
    if (!fs.existsSync(p2)) return send(res, 404, { error: "not found" });
    return send(res, 200, fs.readFileSync(p2), "application/json");
  }

  // ---- static ----
  let filePath = path.join(PUBLIC, p === "/" ? "index.html" : p);
  if (!filePath.startsWith(PUBLIC)) return send(res, 403, { error: "forbidden" });
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(PUBLIC, "index.html");
  }
  const ext = path.extname(filePath);
  send(res, 200, fs.readFileSync(filePath), MIME[ext] || "application/octet-stream");
});

// Seed demo data on first boot if the directory is empty
try {
  const n = seedIfEmpty();
  if (n > 0) console.log(`[agentic-b2b-app] seeded ${n} demo sellers`);
} catch (e) {
  console.error("[agentic-b2b-app] seed skipped:", e.message);
}

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[agentic-b2b-app] running on http://0.0.0.0:${PORT}`);
});
