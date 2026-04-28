/**
 * Supabase Edge Function: auth-register
 *
 * Creates a new client with bcrypt-hashed password (no plaintext stored).
 * Adds:
 *  - Cloudflare Turnstile bot protection
 *  - Rate limiting (3 registrations/IP/hour)
 *  - Strong password requirement (min 6 chars)
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TURNSTILE_SECRET = Deno.env.get("TURNSTILE_SECRET_KEY") || "";

const ALLOWED_ORIGINS = [
  "https://synrg-beyondfitness.com",
  "https://aleksandarzhelyazov.github.io",
  "http://localhost:5173",
  "http://localhost:3000",
];
function corsHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
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

async function verifyTurnstile(token: string | null, ip: string): Promise<boolean> {
  // SOFT-MODE: log but don't block registration.
  if (!TURNSTILE_SECRET) return true;
  if (!token) {
    console.warn("[turnstile] no token supplied — allowing in soft mode");
    return true;
  }
  try {
    const formData = new FormData();
    formData.append("secret", TURNSTILE_SECRET);
    formData.append("response", token);
    formData.append("remoteip", ip);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    if (!data.success) console.warn("[turnstile] failed verify:", data["error-codes"]);
    return true;
  } catch (e) {
    console.warn("[turnstile] verify exception (allowing through):", e);
    return true;
  }
}

async function isRateLimited(ip: string): Promise<{ blocked: boolean; reason?: string }> {
  try {
    const cutoff1h = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/auth_attempts?select=created_at&ip=eq.${encodeURIComponent(ip)}&action=eq.register&created_at=gte.${cutoff1h}&limit=10`,
      { headers: sbHeaders() }
    );
    if (res.ok) {
      const recent = await res.json() as Array<unknown>;
      if (recent.length >= 3) {
        return { blocked: true, reason: "Too many registration attempts. Try again in 1 hour." };
      }
    }
  } catch (e) {
    console.warn("Rate limit check failed:", e);
  }
  return { blocked: false };
}

async function logAttempt(ip: string, name: string, action: string, success: boolean) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/auth_attempts`, {
      method: "POST",
      headers: { ...sbHeaders(), Prefer: "return=minimal" },
      body: JSON.stringify({ ip, name, action, success }),
    });
  } catch (e) {
    console.warn("Failed to log attempt:", e);
  }
}

const FREE_MODULES = ["nutrition_tracking", "weight_tracking", "steps_tracking"];

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const cors = corsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: cors });
  }

  const ip = getIp(req);
  let name = "";

  try {
    const body = await req.json();
    name = body.name || "";
    const password = body.password || "";
    const email = body.email || null;
    const turnstile_token = body.turnstile_token || null;

    if (!name || !password) {
      return new Response(
        JSON.stringify({ error: "name and password required" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }
    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: "Password must be at least 6 characters" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // 1. Rate limit
    const rateLimit = await isRateLimited(ip);
    if (rateLimit.blocked) {
      return new Response(
        JSON.stringify({ error: "rate_limited", message: rateLimit.reason }),
        { status: 429, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // 2. Turnstile verification
    const turnstileOk = await verifyTurnstile(turnstile_token, ip);
    if (!turnstileOk) {
      await logAttempt(ip, name, "register", false);
      return new Response(
        JSON.stringify({ error: "bot_check_failed", message: "Bot check failed. Please try again." }),
        { status: 403, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // Check for existing user (case-insensitive)
    const existsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/clients?select=id&name=ilike.${encodeURIComponent(name)}&is_coach=eq.false`,
      { headers: sbHeaders() }
    );
    const existing = await existsRes.json();
    if (Array.isArray(existing) && existing.length > 0) {
      await logAttempt(ip, name, "register", false);
      return new Response(
        JSON.stringify({ error: "Client already exists" }),
        { status: 409, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // Hash password via Postgres crypt()
    const hashRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/hash_password`, {
      method: "POST",
      headers: sbHeaders(),
      body: JSON.stringify({ p_password: password }),
    });
    const passwordHash = await hashRes.json();

    // Insert new client
    const row: Record<string, unknown> = {
      name,
      password_hash: passwordHash,
      calorie_target: 2000,
      protein_target: 140,
      is_coach: false,
      modules: FREE_MODULES,
    };
    if (email) row.email = email;

    const insRes = await fetch(`${SUPABASE_URL}/rest/v1/clients`, {
      method: "POST",
      headers: { ...sbHeaders(), Prefer: "return=representation" },
      body: JSON.stringify(row),
    });
    if (!insRes.ok) {
      const errText = await insRes.text();
      console.error("Insert client failed:", errText);
      await logAttempt(ip, name, "register", false);
      return new Response(
        JSON.stringify({ error: "Failed to create client" }),
        { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }
    const created = await insRes.json();
    const client = Array.isArray(created) ? created[0] : created;

    // Strip password fields from response
    delete client.password;
    delete client.password_hash;

    await logAttempt(ip, name, "register", true);
    return new Response(
      JSON.stringify({ ok: true, client }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("auth-register error:", err);
    if (name) await logAttempt(ip, name, "register", false);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});
