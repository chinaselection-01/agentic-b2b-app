import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const FILE = path.join(DATA_DIR, "sellers.json");

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
  return read().sellers.map(({ kb, ...rest }) => ({ ...rest, kbLen: (kb || "").length }));
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
