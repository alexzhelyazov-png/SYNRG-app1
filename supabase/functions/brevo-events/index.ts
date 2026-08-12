/**
 * Throwaway diagnostics: Brevo events + unblock a suppressed recipient.
 * Guarded by REPORT_EMAIL_TOKEN. POST { action: "events"|"unblock"|"check", email }.
 */
const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY")!;
const REPORT_EMAIL_TOKEN = Deno.env.get("REPORT_EMAIL_TOKEN")!;
const H = { "api-key": BREVO_API_KEY, Accept: "application/json" };

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("POST only", { status: 405 });
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!REPORT_EMAIL_TOKEN || token !== REPORT_EMAIL_TOKEN) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }
  let b: { action?: string; email?: string; days?: number };
  try { b = await req.json(); } catch { b = {}; }
  const email = b.email || "info@synrg-beyondfitness.com";
  const action = b.action || "events";
  const enc = encodeURIComponent(email);

  if (action === "unblock") {
    const r = await fetch(`https://api.brevo.com/v3/smtp/blockedContacts/${enc}`, {
      method: "DELETE", headers: H,
    });
    const txt = await r.text();
    return new Response(JSON.stringify({ ok: r.ok, status: r.status, detail: txt }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  if (action === "check") {
    const r = await fetch(`https://api.brevo.com/v3/smtp/blockedContacts?limit=100`, { headers: H });
    const d = await r.json();
    const list = (d.contacts || []).filter((c: { email?: string }) => (c.email || "").includes("synrg"));
    return new Response(JSON.stringify({ ok: r.ok, blockedFromSynrg: list, total: d.count }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const r = await fetch(`https://api.brevo.com/v3/smtp/statistics/events?limit=50&email=${enc}`, { headers: H });
  return new Response(JSON.stringify({ ok: r.ok, data: await r.json() }), {
    headers: { "Content-Type": "application/json" },
  });
});
