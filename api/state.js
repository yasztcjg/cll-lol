import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "lol_tracker";

let cache = global._lolTrackerMongo;
if (!cache) cache = global._lolTrackerMongo = { client: null, promise: null };

async function getDb() {
  if (!uri) throw new Error("Falta MONGODB_URI");
  if (cache.client) return cache.client.db(dbName);
  if (!cache.promise) {
    cache.promise = new MongoClient(uri, { maxPoolSize: 5 }).connect();
  }
  cache.client = await cache.promise;
  return cache.client.db(dbName);
}

function cleanKey(raw) {
  const k = String(raw || "").trim().toLowerCase();
  if (k.length < 4 || k.length > 64) return null;
  if (!/^[a-z0-9._-]+$/.test(k)) return null;
  return k;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  try {
    const db = await getDb();
    const col = db.collection("states");

    if (req.method === "GET") {
      const key = cleanKey(req.query.key);
      if (!key) return res.status(400).json({ error: "Clave inválida" });
      const doc = await col.findOne({ _id: key });
      return res.status(200).json({ key, data: doc ? doc.data : null, updatedAt: doc ? doc.updatedAt : null });
    }

    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      const key = cleanKey(body.key);
      if (!key) return res.status(400).json({ error: "Clave inválida" });
      if (!body.data || typeof body.data !== "object") {
        return res.status(400).json({ error: "Faltan datos" });
      }
      const updatedAt = Date.now();
      await col.updateOne(
        { _id: key },
        { $set: { data: body.data, updatedAt } },
        { upsert: true }
      );
      return res.status(200).json({ ok: true, updatedAt });
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Método no permitido" });
  } catch (e) {
    return res.status(500).json({ error: "Error del servidor", detail: String(e.message || e) });
  }
}
