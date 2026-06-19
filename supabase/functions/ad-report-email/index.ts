/**
 * Supabase Edge Function: Ad Report Email (Brevo bridge)
 *
 * Thin, safe bridge so an external scheduler (Claude scheduled task) can send a
 * pre-built HTML report to the SYNRG team without ever holding the Brevo key.
 *
 * - Recipient is HARD-LOCKED to info@synrg-beyondfitness.com (cannot be set by caller),
 *   so even if the endpoint URL leaks it can only ever email the owner.
 * - Requires a shared bearer token (REPORT_EMAIL_TOKEN secret) to prevent abuse.
 * - Accepts only { subject, html } in the body.
 *
 * Deploy:
 *   npx supabase functions deploy ad-report-email --no-verify-jwt --project-ref nzrtdqlgljcipfmectwp
 *
 * Call:
 *   POST .../functions/v1/ad-report-email
 *   Authorization: Bearer <REPORT_EMAIL_TOKEN>
 *   { "subject": "...", "html": "<div>...</div>" }
 */

const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY")!;
const REPORT_EMAIL_TOKEN = Deno.env.get("REPORT_EMAIL_TOKEN")!;

const RECIPIENT = "info@synrg-beyondfitness.com";
const SENDER = { name: "SYNRG Ads Report", email: "info@synrg-beyondfitness.com" };

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "POST only" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Auth: shared bearer token
  const auth = req.headers.get("Authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!REPORT_EMAIL_TOKEN || token !== REPORT_EMAIL_TOKEN) {
    return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: { subject?: string; html?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const subject = (body.subject || "SYNRG · Вечерен отчет реклами").slice(0, 200);
  const html = body.html || "";
  if (!html) {
    return new Response(JSON.stringify({ ok: false, error: "html required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      sender: SENDER,
      to: [{ email: RECIPIENT }],
      subject,
      htmlContent: html,
      headers: { "X-Mailer": "SYNRG Ads Report" },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return new Response(JSON.stringify({ ok: false, error: "brevo failed", status: res.status, detail: text }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true, to: RECIPIENT }), {
    headers: { "Content-Type": "application/json" },
  });
});
