/**
 * Supabase Edge Function: Freemium Broadcast (Brevo) — segmented & idempotent
 *
 * On-demand bridge to email the freemium audience (no active studio plan, no
 * online purchase). Audience is computed server-side so a caller can never
 * target arbitrary people.
 *
 * Segments:
 *   - "active"   → freemium clients who have logged anything (meals or weight)
 *   - "inactive" → freemium clients who have logged nothing
 *   - "all"      → both (default)
 *
 * Idempotency: every successful send is recorded in `email_sends`
 * (client_id, email_key). On a repeat run with the SAME email_key, already-sent
 * recipients are skipped — so a multi-day batch never double-mails anyone.
 *
 * Daily cap: pass { limit: N } to send to at most N not-yet-sent recipients
 * (Brevo free tier = 300/day). Re-run next day with the same email_key to
 * continue with the remainder.
 *
 * - Guarded by REPORT_EMAIL_TOKEN bearer.
 * - Emails recovered from `email` column OR `name` column (legacy bug).
 * - Each recipient gets an individual message (addresses stay private).
 * - { dry_run: true } returns the pending audience count without sending.
 *
 * Deploy:
 *   npx supabase functions deploy freemium-broadcast --no-verify-jwt --project-ref nzrtdqlgljcipfmectwp
 *
 * Call:
 *   POST .../functions/v1/freemium-broadcast
 *   Authorization: Bearer <REPORT_EMAIL_TOKEN>
 *   { "segment":"active", "email_key":"nurture_active_v1",
 *     "subject":"...", "html":"<div>...</div>", "limit":300, "dry_run":false }
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

async function rest(path: string, init?: RequestInit): Promise<Response> {
  return await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
}

async function restGet(path: string): Promise<any[]> {
  const res = await rest(path);
  if (!res.ok) throw new Error(`REST ${path} -> ${res.status} ${await res.text()}`);
  return await res.json();
}

// PostgREST caps a single response at ~1000 rows. For full-table pulls
// (e.g. all clients) page through with offset/limit so nobody is silently
// dropped from the audience.
async function restGetAll(path: string, pageSize = 1000): Promise<any[]> {
  const sep = path.includes("?") ? "&" : "?";
  const out: any[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const page = await restGet(`${path}${sep}limit=${pageSize}&offset=${offset}`);
    out.push(...page);
    if (page.length < pageSize) break;
  }
  return out;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ ok: false, error: "POST only" }, 405);

  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!REPORT_EMAIL_TOKEN || token !== REPORT_EMAIL_TOKEN) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  let body: {
    segment?: string;
    email_key?: string;
    subject?: string;
    html?: string;
    limit?: number;
    dry_run?: boolean;
    exclude_challenge_signups?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "invalid JSON" }, 400);
  }

  const segment = (body.segment || "all").toLowerCase();
  if (!["active", "inactive", "all"].includes(segment)) {
    return json({ ok: false, error: "segment must be active|inactive|all" }, 400);
  }
  const emailKey = (body.email_key || "").trim();
  if (!emailKey) return json({ ok: false, error: "email_key required" }, 400);

  const subject = (body.subject || "").slice(0, 200);
  const html = body.html || "";
  const dryRun = body.dry_run === true;
  const excludeSignups = body.exclude_challenge_signups === true;
  const limit = Number.isFinite(body.limit) ? Math.max(0, Number(body.limit)) : 100000;
  if (!dryRun && (!subject || !html)) {
    return json({ ok: false, error: "subject and html required" }, 400);
  }

  // ── Build freemium audience (no active plan, no purchase) ──
  let clients: any[], plans: any[], purchases: any[];
  let mealClients: any[], weightClients: any[], alreadySent: any[];
  let signedUp: any[] = [];
  try {
    clients = await restGetAll(`clients?select=id,name,email`);
    plans = await restGet(`client_plans?select=client_id&status=eq.active`);
    purchases = await restGet(`program_purchases?select=client_id`);
    mealClients = await restGetAll(`meals?select=client_id`);
    weightClients = await restGetAll(`weight_logs?select=client_id`);
    alreadySent = await restGetAll(
      `email_sends?select=client_id&email_key=eq.${encodeURIComponent(emailKey)}&success=eq.true`,
    );
    if (excludeSignups) signedUp = await restGet(`challenge_signups?select=email`);
  } catch (e) {
    return json({ ok: false, error: "audience query failed", detail: String(e) }, 502);
  }

  const signedUpEmails = new Set<string>(
    signedUp.map((s) => String(s.email || "").trim().toLowerCase()).filter(Boolean),
  );

  const paid = new Set<string>([
    ...plans.map((p) => p.client_id),
    ...purchases.map((p) => p.client_id),
  ]);
  const activeIds = new Set<string>([
    ...mealClients.map((m) => m.client_id),
    ...weightClients.map((w) => w.client_id),
  ]);
  const sentIds = new Set<string>(alreadySent.map((s) => s.client_id));

  const seenEmail = new Set<string>();
  const recipients: { id: string; email: string }[] = [];
  for (const c of clients) {
    if (paid.has(c.id)) continue;
    if (sentIds.has(c.id)) continue; // idempotent skip
    const isActive = activeIds.has(c.id);
    if (segment === "active" && !isActive) continue;
    if (segment === "inactive" && isActive) continue;

    let email = "";
    if (c.email && EMAIL_RE.test(String(c.email).trim())) email = String(c.email).trim().toLowerCase();
    else if (c.name && EMAIL_RE.test(String(c.name).trim())) email = String(c.name).trim().toLowerCase();
    if (!email || seenEmail.has(email)) continue;
    if (excludeSignups && signedUpEmails.has(email)) continue; // already signed up
    seenEmail.add(email);
    recipients.push({ id: c.id, email });
  }

  const pending = recipients.length;
  const queue = recipients.slice(0, limit);

  if (dryRun) {
    return json({
      ok: true,
      dry_run: true,
      segment,
      email_key: emailKey,
      pending,
      will_send: queue.length,
      sample: queue.slice(0, 5).map((r) => r.email),
    });
  }

  // ── Send individually, batched; record each in email_sends ──
  let sent = 0, failed = 0;
  const errors: string[] = [];
  const BATCH = 12;
  for (let i = 0; i < queue.length; i += BATCH) {
    const slice = queue.slice(i, i + BATCH);
    const results = await Promise.all(slice.map(async (r) => {
      try {
        const res = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            sender: SENDER,
            to: [{ email: r.email }],
            subject,
            htmlContent: html,
            headers: { "X-Mailer": "SYNRG Freemium Broadcast" },
          }),
        });
        if (!res.ok) {
          if (errors.length < 5) errors.push(`${r.email}: ${res.status} ${(await res.text()).slice(0, 120)}`);
          return { ok: false, id: r.id };
        }
        return { ok: true, id: r.id };
      } catch (e) {
        if (errors.length < 5) errors.push(`${r.email}: ${String(e).slice(0, 120)}`);
        return { ok: false, id: r.id };
      }
    }));
    // Record successful sends (idempotent upsert on client_id+email_key)
    const okIds = results.filter((x) => x.ok).map((x) => x.id);
    if (okIds.length) {
      const rows = okIds.map((id) => ({ client_id: id, email_key: emailKey, success: true }));
      await rest(`email_sends?on_conflict=client_id,email_key`, {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(rows),
      }).catch(() => {});
    }
    for (const x of results) x.ok ? sent++ : failed++;
  }

  return json({ ok: true, segment, email_key: emailKey, pending, sent, failed, errors });
});
