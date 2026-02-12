export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false });
    return;
  }

  try {
    // Los navegadores envían reportes con distintos formatos
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    // Log mínimo (Vercel logs)
    console.log("CSP REPORT:", JSON.stringify(body).slice(0, 4000));

    res.status(204).end();
  } catch (e) {
    console.log("CSP REPORT parse error:", e?.message || e);
    res.status(204).end();
  }
}
