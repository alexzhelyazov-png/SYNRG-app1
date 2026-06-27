/**
 * Supabase Edge Function: signup-challenge  (PHASE 1 warm + PHASE 2 cold)
 *
 * Connects the standalone signup form to the DB. Flow:
 *   1. Validate { name, email, phone, committed, consent }.
 *   2. Find the email in `clients`.
 *        - Found (warm)     → reuse the existing freemium/studio profile.
 *        - Not found (cold) → PHASE 2: auto-create a freemium profile
 *          (FREE_MODULES, account_type='free', random password) and issue a
 *          6-digit onboarding code in `password_resets` so the lead can set a
 *          password and log in. This lets cold TikTok/ad traffic (no prior
 *          account) join the challenge and enter the freemium funnel.
 *   3. Ensure an upcoming cohort exists (RPC) and insert a `challenge_signups`
 *      row for it (source='warm' | 'cold'). Idempotent per (email, cohort).
 *   4. Send an email via Brevo — warm: confirmation (start date + Viber CTA);
 *      cold: onboarding (set-password deep-link + code) + start date + Viber CTA.
 *      Email failure never fails the signup.
 *
 * Protections: rate limiting (5 / IP / hour) reusing `auth_attempts`,
 * dedupe via UNIQUE(email, cohort_id). Writes use the service role, so the
 * public never gets direct insert access to the table.
 *
 * Deploy:
 *   npx supabase functions deploy signup-challenge --no-verify-jwt --project-ref nzrtdqlgljcipfmectwp
 *
 * Secrets:
 *   VIBER_INVITE_LINK  — the weekly Viber group invite (falls back to placeholder).
 *   BREVO_API_KEY      — Brevo transactional email key (shared with other fns).
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VIBER_INVITE_LINK =
  Deno.env.get("VIBER_INVITE_LINK") || "https://invite.viber.com/?g2=ZAMENI_S_TVOQ_LINK";
const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY") || "";
const EMAIL_SENDER = "info@synrg-beyondfitness.com";
const EMAIL_SENDER_NAME = "SYNRG Beyond Fitness";
const APP_URL = "https://synrg-beyondfitness.com/app/";

// Freemium baseline — matches auth-register / stripe-webhook.
const FREE_MODULES = ["nutrition_tracking", "weight_tracking", "steps_tracking"];

// Public lead form may be embedded anywhere (site, Wix, standalone file).
// No credentials are ever sent, and the endpoint is rate-limited, so a
// wildcard origin is acceptable here.
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function sbHeaders() {
  return {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    "Content-Type": "application/json",
  };
}

function getIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

function validEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}
function validPhone(v: string): boolean {
  return v.replace(/\D/g, "").length >= 9;
}

async function isRateLimited(ip: string): Promise<boolean> {
  try {
    const cutoff1h = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/auth_attempts?select=created_at&ip=eq.${encodeURIComponent(ip)}&action=eq.challenge_signup&created_at=gte.${cutoff1h}&limit=20`,
      { headers: sbHeaders() }
    );
    if (res.ok) {
      const recent = (await res.json()) as Array<unknown>;
      if (recent.length >= 5) return true;
    }
  } catch (e) {
    console.warn("rate limit check failed:", e);
  }
  return false;
}

async function logAttempt(ip: string, email: string, success: boolean) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/auth_attempts`, {
      method: "POST",
      headers: { ...sbHeaders(), Prefer: "return=minimal" },
      body: JSON.stringify({ ip, name: email, action: "challenge_signup", success }),
    });
  } catch (e) {
    console.warn("failed to log attempt:", e);
  }
}

// Resolve a warm user's profile id by email. Falls back to the legacy case
// where an email was stored in the `name` column (older freemium rows).
async function findProfileByEmail(email: string): Promise<{ id: string; name: string } | null> {
  const enc = encodeURIComponent(email);
  const byEmail = await fetch(
    `${SUPABASE_URL}/rest/v1/clients?select=id,name&email=ilike.${enc}&is_coach=eq.false&limit=1`,
    { headers: sbHeaders() }
  );
  if (byEmail.ok) {
    const rows = (await byEmail.json()) as Array<{ id: string; name: string }>;
    if (rows.length > 0) return rows[0];
  }
  const byName = await fetch(
    `${SUPABASE_URL}/rest/v1/clients?select=id,name&name=ilike.${enc}&is_coach=eq.false&limit=1`,
    { headers: sbHeaders() }
  );
  if (byName.ok) {
    const rows = (await byName.json()) as Array<{ id: string; name: string }>;
    if (rows.length > 0) return rows[0];
  }
  return null;
}

// PHASE 2 — create a freemium profile for a cold lead (no prior account).
// Random password hash (the lead sets a real one via the onboarding code).
// Mirrors auth-register / stripe-webhook: FREE_MODULES, is_coach=false.
async function createColdProfile(email: string, name: string): Promise<string | null> {
  const randomPassword = crypto.randomUUID() + crypto.randomUUID();
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(randomPassword));
  const passwordHash = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  const res = await fetch(`${SUPABASE_URL}/rest/v1/clients`, {
    method: "POST",
    headers: { ...sbHeaders(), Prefer: "return=representation" },
    body: JSON.stringify({
      email,
      name: name || email.split("@")[0],
      password_hash: passwordHash,
      calorie_target: 2000,
      protein_target: 140,
      is_coach: false,
      modules: FREE_MODULES,
      account_type: "free",
    }),
  });
  if (!res.ok) {
    console.error("createColdProfile failed:", res.status, await res.text());
    return null;
  }
  const created = await res.json();
  const row = Array.isArray(created) ? created[0] : created;
  return row?.id || null;
}

// Generate a 6-digit one-time code in password_resets so the new client can set
// a password and log in. 24h validity. Mirrors stripe-webhook.issueOnboardingCode.
async function issueOnboardingCode(clientId: string, email: string): Promise<string | null> {
  try {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await fetch(`${SUPABASE_URL}/rest/v1/password_resets?email=eq.${encodeURIComponent(email)}`, {
      method: "DELETE",
      headers: sbHeaders(),
    });
    await fetch(`${SUPABASE_URL}/rest/v1/password_resets`, {
      method: "POST",
      headers: { ...sbHeaders(), Prefer: "return=minimal" },
      body: JSON.stringify({ email, code, client_id: clientId, expires_at: expiresAt }),
    });
    return code;
  } catch (e) {
    console.error("issueOnboardingCode failed:", e);
    return null;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Confirmation email (approved copy). Brand chrome: #1a1a1a bg, #c4e9bf accent.
// Failure is swallowed by the caller — the signup must succeed regardless.
async function sendChallengeEmail(toEmail: string, name: string): Promise<void> {
  if (!BREVO_API_KEY) {
    console.warn("BREVO_API_KEY missing — skipping confirmation email");
    return;
  }
  const firstName = escapeHtml((name || "").split(/\s+/)[0] || "");
  const subject = "Мястото ти е запазено · започваме в понеделник";
  const html = `<!DOCTYPE html>
<html lang="bg"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#1a1a1a;">
  <div style="max-width:520px;margin:0 auto;padding:32px 24px;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#f2f2f2;">
    <div style="font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#c4e9bf;margin-bottom:18px;">SYNRG · 7 дни яснота</div>
    <p style="font-size:17px;line-height:1.6;margin:0 0 16px;">Здравей, ${firstName},</p>
    <p style="font-size:17px;line-height:1.6;margin:0 0 16px;">Мястото ти в <strong style="color:#c4e9bf;">7 дни яснота</strong> е запазено. Започваме в <strong>понеделник (29.06)</strong>.</p>
    <p style="font-size:17px;line-height:1.6;margin:0 0 16px;">Една малка стъпка на ден — само 5 минути. Без диети, без забрани. Аз и Кари сме с теб всеки ден в групата.</p>
    <p style="font-size:17px;line-height:1.6;margin:0 0 20px;"><strong>Последна стъпка:</strong> влез във Viber групата, за да си вътре от старта:</p>
    <p style="margin:0 0 28px;">
      <a href="${VIBER_INVITE_LINK}" style="display:inline-block;background:#c4e9bf;color:#0e2018;text-decoration:none;font-weight:700;font-size:16px;padding:14px 26px;border-radius:10px;">Влез в Viber групата</a>
    </p>
    <p style="font-size:17px;line-height:1.6;margin:0 0 4px;">До понеделник,</p>
    <p style="font-size:17px;line-height:1.6;margin:0 0 24px;">Екипът на SYNRG</p>
    <p style="font-size:14px;line-height:1.6;color:#9a9a9a;font-style:italic;border-top:1px solid #333;padding-top:18px;margin:0;">Ако записването на храна някога ти е носило тревожност — чуй себе си, няма нужда на сила.</p>
  </div>
</body></html>`;

  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": BREVO_API_KEY,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sender: { email: EMAIL_SENDER, name: EMAIL_SENDER_NAME },
        to: [{ email: toEmail, name: name || undefined }],
        subject,
        htmlContent: html,
      }),
    });
    if (!res.ok) {
      console.error("Brevo send failed:", res.status, await res.text());
    }
  } catch (e) {
    console.error("Brevo send error:", e);
  }
}

// PHASE 2 — cold onboarding email: account created + set-password deep-link +
// 6-digit code + challenge start date + Viber CTA. Best-effort (never blocks).
async function sendColdOnboardingEmail(toEmail: string, name: string, code: string): Promise<void> {
  if (!BREVO_API_KEY) {
    console.warn("BREVO_API_KEY missing — skipping onboarding email");
    return;
  }
  const firstName = escapeHtml((name || "").split(/\s+/)[0] || "");
  const setupUrl = `${APP_URL}?reset=${encodeURIComponent(toEmail)}&code=${code}`;
  const subject = "Влез в SYNRG · мястото ти за понеделник е запазено";
  const html = `<!DOCTYPE html>
<html lang="bg"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#1a1a1a;">
  <div style="max-width:520px;margin:0 auto;padding:32px 24px;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#f2f2f2;">
    <div style="font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#c4e9bf;margin-bottom:18px;">SYNRG · 7 дни предизвикателство</div>
    <p style="font-size:17px;line-height:1.6;margin:0 0 16px;">Здравей, ${firstName},</p>
    <p style="font-size:17px;line-height:1.6;margin:0 0 16px;">Мястото ти е запазено — <strong style="color:#c4e9bf;">започваме в понеделник (29.06)</strong>. Създадохме ти и безплатен профил в нашето приложение, където ще правим дневните задачи.</p>
    <p style="font-size:17px;line-height:1.6;margin:0 0 20px;"><strong>Първа стъпка:</strong> задай си парола и влез:</p>
    <p style="margin:0 0 22px;">
      <a href="${setupUrl}" style="display:inline-block;background:#c4e9bf;color:#0e2018;text-decoration:none;font-weight:700;font-size:16px;padding:14px 26px;border-radius:10px;">Задай парола и влез</a>
    </p>
    <p style="font-size:14px;line-height:1.6;color:#bbbbbb;margin:0 0 10px;">Ако бутонът не работи, отвори <a href="${APP_URL}" style="color:#c4e9bf;">приложението</a>, натисни „Забравена парола", въведи имейла си и този код:</p>
    <div style="font-size:24px;letter-spacing:6px;font-weight:700;color:#c4e9bf;text-align:center;padding:14px;background:#0d1510;border-radius:12px;margin:0 0 8px;">${code}</div>
    <p style="font-size:13px;line-height:1.6;color:#9a9a9a;margin:0 0 24px;">Кодът е валиден 24 часа.</p>
    <p style="font-size:17px;line-height:1.6;margin:0 0 16px;"><strong>Втора стъпка:</strong> влез във Viber групата, за да си вътре от старта — аз и Кари сме с теб всеки ден:</p>
    <p style="margin:0 0 28px;">
      <a href="${VIBER_INVITE_LINK}" style="display:inline-block;background:transparent;color:#c4e9bf;text-decoration:none;font-weight:700;font-size:16px;padding:13px 25px;border-radius:10px;border:1px solid #c4e9bf;">Влез в Viber групата</a>
    </p>
    <p style="font-size:17px;line-height:1.6;margin:0 0 4px;">До понеделник,</p>
    <p style="font-size:17px;line-height:1.6;margin:0 0 24px;">Екипът на SYNRG</p>
    <p style="font-size:12px;line-height:1.6;color:#666;border-top:1px solid #333;padding-top:18px;margin:0;">SYNRG Beyond Fitness · Синерджи 93 ООД</p>
  </div>
</body></html>`;

  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": BREVO_API_KEY,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sender: { email: EMAIL_SENDER, name: EMAIL_SENDER_NAME },
        to: [{ email: toEmail, name: name || undefined }],
        subject,
        htmlContent: html,
      }),
    });
    if (!res.ok) {
      console.error("Brevo onboarding send failed:", res.status, await res.text());
    }
  } catch (e) {
    console.error("Brevo onboarding send error:", e);
  }
}

Deno.serve(async (req: Request) => {
  const cors = corsHeaders();

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "POST only" }), {
      status: 405,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const ip = getIp(req);
  let email = "";

  try {
    const body = await req.json();
    const name = (body.name || "").trim();
    email = (body.email || "").trim().toLowerCase();
    const phone = (body.phone || "").trim();
    const committed = body.committed === true;
    const consent = body.consent === true;

    // 1. Validation
    if (!name) {
      return json(cors, 400, { ok: false, error: "name_required", message: "Напиши името си." });
    }
    if (!validEmail(email)) {
      return json(cors, 400, { ok: false, error: "bad_email", message: "Провери имейла." });
    }
    if (!validPhone(phone)) {
      return json(cors, 400, { ok: false, error: "bad_phone", message: "Провери Viber номера." });
    }
    if (!committed) {
      return json(cors, 400, { ok: false, error: "not_committed", message: "Потвърди, че влизаш за 7 дни." });
    }
    if (!consent) {
      return json(cors, 400, { ok: false, error: "no_consent", message: "Трябва съгласие за обработка на данните." });
    }

    // 2. Rate limit
    if (await isRateLimited(ip)) {
      return json(cors, 429, { ok: false, error: "rate_limited", message: "Твърде много опити. Опитай пак след малко." });
    }

    // 3. Match an existing profile (warm) OR auto-create a freemium one (cold).
    let profile = await findProfileByEmail(email);
    let isCold = false;
    let onboardingCode: string | null = null;
    if (!profile) {
      const newId = await createColdProfile(email, name);
      if (!newId) {
        await logAttempt(ip, email, false);
        return json(cors, 500, { ok: false, error: "profile_failed", message: "Възникна грешка. Опитай пак." });
      }
      profile = { id: newId, name };
      isCold = true;
      onboardingCode = await issueOnboardingCode(newId, email);
    }

    // 4. Ensure an upcoming cohort and get its id
    const cohortRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/ensure_upcoming_cohort`, {
      method: "POST",
      headers: sbHeaders(),
      body: JSON.stringify({}),
    });
    if (!cohortRes.ok) {
      console.error("ensure_upcoming_cohort failed:", await cohortRes.text());
      return json(cors, 500, { ok: false, error: "no_cohort", message: "Възникна грешка. Опитай пак." });
    }
    const cohortId = await cohortRes.json();

    // 5. Insert signup (idempotent per email+cohort). On conflict, treat as success.
    const insRes = await fetch(`${SUPABASE_URL}/rest/v1/challenge_signups?on_conflict=email,cohort_id`, {
      method: "POST",
      headers: { ...sbHeaders(), Prefer: "return=minimal,resolution=ignore-duplicates" },
      body: JSON.stringify({
        profile_id: profile.id,
        cohort_id: cohortId,
        name,
        email,
        phone,
        committed: true,
        consent: true,
        source: isCold ? "cold" : "warm",
      }),
    });
    if (!insRes.ok) {
      const txt = await insRes.text();
      console.error("insert signup failed:", insRes.status, txt);
      await logAttempt(ip, email, false);
      return json(cors, 500, { ok: false, error: "insert_failed", message: "Възникна грешка. Опитай пак." });
    }

    await logAttempt(ip, email, true);
    // Email — best-effort, never blocks the response.
    // Cold leads get the onboarding (set-password) email; warm get confirmation.
    if (isCold && onboardingCode) {
      await sendColdOnboardingEmail(email, name, onboardingCode);
    } else {
      await sendChallengeEmail(email, name);
    }
    return json(cors, 200, { ok: true, viber_link: VIBER_INVITE_LINK, is_new: isCold });
  } catch (err) {
    console.error("signup-challenge error:", err);
    if (email) await logAttempt(ip, email, false);
    return json(cors, 500, { ok: false, error: "server_error", message: "Възникна грешка. Опитай пак." });
  }
});

function json(cors: Record<string, string>, status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
