// Movie Watchlist - the list lives in the browser. Matching movies to your MOOD ("something funny")
// uses QVAC embeddings on YOUR machine. Open http://localhost:3009 after starting.

import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { loadModel, embed, EMBEDDINGGEMMA_300M_Q4_0 } from "@qvac/sdk";

const PORT = 3009;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---- Step 1: load the embedding model (downloads the first time) ----
let modelId = null;
const status = { ready: false, message: "Starting...", percent: null, error: null };

async function startModel() {
  try {
    status.message = "Loading the movie-matching model (first run downloads it)...";
    modelId = await loadModel({
      modelSrc: EMBEDDINGGEMMA_300M_Q4_0,
      modelType: "embeddings",
      onProgress: (p) => {
        const value = typeof p === "number" ? p : p?.percentage;
        if (typeof value === "number") status.percent = Math.round(value);
      },
    });
    status.ready = true;
    status.message = "Movie matching ready";
    console.log("Model loaded. Open http://localhost:" + PORT);
  } catch (err) {
    status.error = String(err?.message || err);
    console.error("Could not load model:", err);
  }
}

// ---- Step 2: turn text into numbers (an "embedding") with QVAC. Similar meanings get similar numbers. ----
const cache = new Map(); // remember vectors so repeat searches are instant

async function vectors(texts) {
  if (cache.size > 800) cache.clear();
  const missing = [...new Set(texts.filter((t) => !cache.has(t)))];
  for (let i = 0; i < missing.length; i += 16) {
    const batch = missing.slice(i, i + 16);
    const out = await embed({ modelId, text: batch });
    const emb = out.embedding ?? out.embeddings ?? out;
    const rows = Array.isArray(emb[0]) ? emb : [emb];
    batch.forEach((t, k) => cache.set(t, rows[k]));
  }
  return texts.map((t) => cache.get(t));
}

// How close are two meanings? 1 = the same, 0 = unrelated.
function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] ** 2; nb += b[i] ** 2; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

// ---- Step 3: rank the movies against a mood (or against another movie) ----
async function rank(query, items, useKeywords, limit) {
  const [queryVec, ...itemVecs] = await vectors([query, ...items.map((i) => i.text)]);
  const words = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  return items
    .map((item, k) => {
      const hay = item.text.toLowerCase();
      const bonus = useKeywords && words.length ? (words.filter((w) => hay.includes(w)).length / words.length) * 0.15 : 0;
      return { id: item.id, score: cosine(queryVec, itemVecs[k]) + bonus };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// ---- Step 4: a small web server ----
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => { data += c; if (data.length > 200000) { reject(new Error("Too big")); req.destroy(); } });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}
const json = (res, code, obj) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(obj)); };

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return res.end(await readFile(path.join(__dirname, "public", "index.html")));
  }
  if (req.method === "GET" && req.url === "/api/status") return json(res, 200, status);

  if (req.method === "POST" && req.url === "/api/rank") {
    if (!status.ready) return json(res, 503, { error: "Movie matching is not ready yet." });
    try {
      const body = JSON.parse(await readBody(req));
      const query = String(body.query || "").trim().slice(0, 300);
      const items = (Array.isArray(body.items) ? body.items : []).slice(0, 300)
        .map((i) => ({ id: String(i.id).slice(0, 40), text: String(i.text || "").slice(0, 300) })).filter((i) => i.text);
      if (!query || !items.length) return json(res, 200, []);
      return json(res, 200, await rank(query, items, body.keywords !== false, Math.min(Number(body.limit) || 3, 6)));
    } catch (err) {
      console.error(err);
      return json(res, 500, { error: String(err?.message || err) });
    }
  }

  res.writeHead(404);
  res.end("Not found");
});

// "127.0.0.1" means only YOUR computer can reach this app
server.listen(PORT, "127.0.0.1", () => console.log("Server running at http://localhost:" + PORT));
startModel();
