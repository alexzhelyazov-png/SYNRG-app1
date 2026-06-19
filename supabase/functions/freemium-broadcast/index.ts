/**
 * Supabase Edge Function: Freemium Broadcast (Brevo)
 *
 * One-off / on-demand bridge to email TODAY's freemium signups (no studio plan,
 * no online purchase). Audience is computed server-side so a caller can never
 * target arbitrary people — only today's freemium users.
 *
 * - Guarded by REPORT_EMAIL_TOKEN bearer (reuses existing secret).
 * - Emails are recovered from the `email` column OR the `name` column (a past
 *   registration bug stored some emails in `name`).
 * - Each recipient is sent an individual message (addresses stay private).
 * - Pass { dry_run: true } to get the audience count without sending.
 *
 * Deploy:
 *   npx supabase functions deploy freemium-broadcast --no-verify-jwt --project-ref nzrtdqlgljcipfmectwp
 *
 * Call:
 *   POST .../functions/v1/freemium-broadcast
 *   Authorization: Bearer <REPORT_EMAIL_TOKEN>
 *   { "subject": "...", "html": "<div>...</div>", "dry_run": false }
 */

const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY")!;
const REPORT_EMAIL_TOKEN = Deno.env.get("REPORT_EMAIL_TOKEN")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const SENDER = { name: "SYNRG Beyond Fitness", email: "info@synrg-beyondfitness.com" };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function rest(path: string): Promise<any[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  if (!res.ok) throw new Error(`REST ${path} -> ${res.status} ${await res.text()}`);
  return await res.json();
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ ok: false, error: "POST only" }, 405);

  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!REPORT_EMAIL_TOKEN || token !== REPORT_EMAIL_TOKEN) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  let body: { subject?: string; html?: string; dry_run?: boolean };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "invalid JSON" }, 400);
  }

  const subject = (body.subject || "").slice(0, 200);
  const html = body.html || "";
  const dryRun = body.dry_run === true;
  if (!dryRun && (!subject || !html)) {
    return json({ ok: false, error: "subject and html required" }, 400);
  }

  // ── Build audience: today's freemium signups (UTC day) ──
  const today = new Date().toISOString().slice(0, 10);
  let clientsToday: any[], plans: any[], purchases: any[];
  try {
    clientsToday = await rest(
      `clients?select=id,name,email,created_at&created_at=gte.${today}`,
    );
    plans = await rest(`client_plans?select=client_id`);
    purchases = await rest(`program_purchases?select=client_id`);
  } catch (e) {
    return json({ ok: false, error: "audience query failed", detail: String(e) }, 502);
  }

  const paid = new Set<string>([
    ...plans.map((p) => p.client_id),
    ...purchases.map((p) => p.client_id),
  ]);

  const seen = new Set<string>();
  const recipients: string[] = [];
  for (const c of clientsToday) {
    if (paid.has(c.id)) continue;
    let email = "";
    if (c.email && EMAIL_RE.test(String(c.email).trim())) email = String(c.email).trim().toLowerCase();
    else if (c.name && EMAIL_RE.test(String(c.name).trim())) email = String(c.name).trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    recipients.push(email);
  }

  if (dryRun) {
    return json({ ok: true, dry_run: true, audience: recipients.length, sample: recipients.slice(0, 5) });
  }

  // ── Send individually, batched for speed ──
  let sent = 0, failed = 0;
  const errors: string[] = [];
  const BATCH = 12;
  for (let i = 0; i < recipients.length; i += BATCH) {
    const slice = recipients.slice(i, i + BATCH);
    const results = await Promise.all(slice.map(async (email) => {
      try {
        const res = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            sender: SENDER,
            to: [{ email }],
            subject,
            htmlContent: html,
            headers: { "X-Mailer": "SYNRG Freemium Broadcast" },
          }),
        });
        if (!res.ok) {
          if (errors.length < 5) errors.push(`${email}: ${res.status} ${(await res.text()).slice(0, 120)}`);
          return false;
        }
        return true;
      } catch (e) {
        if (errors.length < 5) errors.push(`${email}: ${String(e).slice(0, 120)}`);
        return false;
      }
    }));
    for (const ok of results) ok ? sent++ : failed++;
  }

  return json({ ok: true, audience: recipients.length, sent, failed, errors });
});
