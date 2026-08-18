const REGIONS = ["LAN","LAS","NA","BR","EUW","EUNE","KR","JP","OCE","TR","RU","TW","VN","SG","PH","TH","ME"];
const TIERS = ["challenger", "grandmaster"];

export default async function handler(req, res) {
  // El corte cambia poco a poco: cachear 30 min evita golpear la fuente en cada carga.
  res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=3600");

  const region = String(req.query.region || "LAN").toUpperCase();
  const tier = String(req.query.tier || "challenger").toLowerCase();

  if (!REGIONS.includes(region)) return res.status(400).json({ error: "Región inválida" });
  if (!TIERS.includes(tier)) return res.status(400).json({ error: "Rango inválido" });

  const url = `https://www.replays.lol/cutoff/${region}/${tier}`;

  try {
    const r = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125 Safari/537.36",
        "Accept-Language": "es,en;q=0.8"
      }
    });
    if (!r.ok) throw new Error("HTTP " + r.status);

    const html = await r.text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;|&#160;/g, " ")
      .replace(/\s+/g, " ");

    // La página muestra "You need  1,471 LP" justo antes de la tabla de líderes.
    let m = text.match(/You need\s*([\d.,]{2,8})\s*LP/i);
    if (!m) m = text.match(/([\d.,]{3,8})\s*LP/);
    if (!m) throw new Error("No se encontró el valor");

    const lp = parseInt(m[1].replace(/[.,]/g, ""), 10);
    if (!Number.isFinite(lp) || lp <= 0 || lp > 5000) throw new Error("Valor fuera de rango");

    return res.status(200).json({ region, tier, lp, source: url, fetchedAt: Date.now() });
  } catch (e) {
    return res.status(502).json({ error: "No se pudo leer el corte", source: url, detail: String(e.message || e) });
  }
}
