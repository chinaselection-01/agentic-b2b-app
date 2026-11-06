import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const FILE = path.join(DATA_DIR, "sellers.json");
const SEED_FILE = path.join(__dirname, "..", "seed", "sellers.json");

function ensure() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, JSON.stringify({ sellers: [] }, null, 2));
}
function read() {
  ensure();
  return JSON.parse(fs.readFileSync(FILE, "utf8"));
}
function write(db) {
  fs.writeFileSync(FILE, JSON.stringify(db, null, 2));
}

export function listSellers() {
  return read().sellers.map(({ kb, token, ...rest }) => ({ ...rest, kbLen: (kb || "").length }));
}

export function getSeller(id) {
  return read().sellers.find((s) => s.id === id) || null;
}

export function createSeller(input) {
  const db = read();
  const seller = {
    id: crypto.randomBytes(6).toString("hex"),
    token: crypto.randomBytes(12).toString("hex"),
    name: input.name || "Unnamed seller",
    owner: input.owner || "",
    contact: input.contact || "",
    phone: input.phone || "",
    offerings: Array.isArray(input.offerings)
      ? input.offerings
      : String(input.offerings || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
    languages: Array.isArray(input.languages)
      ? input.languages
      : String(input.languages || "en")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
    kb: input.kb || "",
    createdAt: new Date().toISOString(),
  };
  db.sellers.push(seller);
  write(db);
  return seller;
}

// token-authenticated update; returns {seller} or {error}
export function updateSeller(id, token, patch) {
  const db = read();
  const s = db.sellers.find((x) => x.id === id);
  if (!s) return { error: "not found" };
  if (s.token !== token) return { error: "forbidden" };
  for (const k of ["name", "owner", "contact", "phone", "offerings", "languages", "kb"]) {
    if (k in patch) s[k] = patch[k];
  }
  write(db);
  return { seller: s };
}

// token-authenticated delete; returns {ok} or {error}
export function deleteSeller(id, token) {
  const db = read();
  const s = db.sellers.find((x) => x.id === id);
  if (!s) return { error: "not found" };
  if (s.token !== token) return { error: "forbidden" };
  db.sellers = db.sellers.filter((x) => x.id !== id);
  write(db);
  return { ok: true };
}

// admin reset (demo only) — protected by ADMIN_KEY
export function deleteAll(adminKey) {
  if (adminKey !== process.env.ADMIN_KEY) return { error: "forbidden" };
  write({ sellers: [] });
  return { ok: true };
}

export function hasAny() {
  return read().sellers.length > 0;
}

// seed demo sellers only when the directory is empty
export function seedIfEmpty() {
  if (hasAny()) return 0;
  let seed = [];
  try {
    seed = JSON.parse(fs.readFileSync(SEED_FILE, "utf8"));
  } catch {
    return 0;
  }
  for (const entry of seed) createSeller(entry);
  return seed.length;
}
