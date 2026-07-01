/**
 * Throwaway: Brevo transactional aggregated report for a date range.
 * Guarded by REPORT_EMAIL_TOKEN. POST { startDate, endDate }.
 */
const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY")!;
const REPORT_EMAIL_TOKEN = Deno.env.get("REPORT_EMAIL_TOKEN")!;

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("POST only", { status: 405 });
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!REPORT_EMAIL_TOKEN || token !== REPORT_EMAIL_TOKEN) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }
  let body: { startDate?: string; endDate?: string };
  try { body = await req.json(); } catch { body = {}; }
  const startDate = body.startDate || new Date().toISOString().slice(0, 10);
  const endDate = body.endDate || startDate;

  const res = await fetch(
    `https://api.brevo.com/v3/smtp/statistics/aggregatedReport?startDate=${startDate}&endDate=${endDate}`,
    { headers: { "api-key": BREVO_API_KEY, Accept: "application/json" } },
  );
  const data = await res.json();
  return new Response(JSON.stringify({ ok: res.ok, startDate, endDate, data }), {
    status: res.ok ? 200 : 502,
    headers: { "Content-Type": "application/json" },
  });
});
