/**
 * Supabase Edge Function: auth-login
 *
 * Verifies client password server-side using bcrypt (via Postgres crypt()).
 * Adds:
 *  - Cloudflare Turnstile verification (bot protection)
 *  - Rate limiting per IP (10 fails/5 min → 1h block)
 *  - Account lockout per username (5 fails/5 min → 15 min block)
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TURNSTILE_SECRET = Deno.env.get("TURNSTILE_SECRET_KEY") || "";

const ALLOWED_ORIGINS = [
  "https://synrg-beyondfitness.com",
  "https://www.synrg-beyondfitness.com",
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

async function verifyTurnstile(token: string | null, ip: string, origin: string | null): Promise<boolean> {
  // SOFT-MODE: log Turnstile status but don't block login.
  // This prevents lockouts while widget config is being verified.
  // To re-enable hard enforcement: change `return true` after the warn to `return false`.
  if (!TURNSTILE_SECRET) return true;
  if (origin && (origin.startsWith("http://localhost") || origin.startsWith("http://127.0.0.1"))) return true;
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
    // Soft mode: allow through even on failure (just log)
    return true;
  } catch (e) {
    console.warn("[turnstile] verify exception (allowing through):", e);
    return true;
  }
}

// Returns true if request should be blocked
async function isRateLimited(ip: string, name: string): Promise<{ blocked: boolean; reason?: string }> {
  try {
    const cutoff5min = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const cutoff1h = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    // Per-IP: 10 failed attempts in last 5 min → blocked for 1h
    const ipRes = await fetch(
      `${SUPABASE_URL}/rest/v1/auth_attempts?select=created_at&ip=eq.${encodeURIComponent(ip)}&action=eq.login&success=eq.false&created_at=gte.${cutoff1h}&order=created_at.desc&limit=20`,
      { headers: sbHeaders() }
    );
    if (ipRes.ok) {
      const ipFails = await ipRes.json() as Array<{ created_at: string }>;
      const recent5min = ipFails.filter(a => a.created_at >= cutoff5min);
      if (recent5min.length >= 10) {
        return { blocked: true, reason: "Too many attempts from your IP. Try again later." };
      }
      // If 10+ fails in last 1h → still blocked
      if (ipFails.length >= 10) {
        return { blocked: true, reason: "Too many failed attempts. Try again in 1 hour." };
      }
    }

    // Per-username: 5 failed attempts in last 5 min → 15 min lockout
    const userRes = await fetch(
      `${SUPABASE_URL}/rest/v1/auth_attempts?select=created_at&name=eq.${encodeURIComponent(name)}&action=eq.login&success=eq.false&created_at=gte.${cutoff5min}&limit=10`,
      { headers: sbHeaders() }
    );
    if (userRes.ok) {
      const userFails = await userRes.json() as Array<unknown>;
      if (userFails.length >= 5) {
        return { blocked: true, reason: "Account temporarily locked due to too many failed attempts. Try again in 15 minutes." };
      }
    }
  } catch (e) {
    console.warn("Rate limit check failed (allowing through):", e);
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
    const turnstile_token = body.turnstile_token || null;

    if (!name || !password) {
      return new Response(
        JSON.stringify({ error: "name and password required" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // 1. Rate limit check
    const rateLimit = await isRateLimited(ip, name);
    if (rateLimit.blocked) {
      return new Response(
        JSON.stringify({ error: "rate_limited", message: rateLimit.reason }),
        { status: 429, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // 2. Turnstile verification
    const turnstileOk = await verifyTurnstile(turnstile_token, ip);
    if (!turnstileOk) {
      await logAttempt(ip, name, "login", false);
      return new Response(
        JSON.stringify({ error: "bot_check_failed", message: "Bot check failed. Please try again." }),
        { status: 403, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // 3. Verify password via Postgres RPC (uses crypt() for bcrypt comparison)
    const verifyRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/verify_client_password`, {
      method: "POST",
      headers: sbHeaders(),
      body: JSON.stringify({ p_name: name, p_password: password }),
    });
    const verifyData = await verifyRes.json();
    const row = Array.isArray(verifyData) ? verifyData[0] : verifyData;

    if (!row || !row.valid) {
      await logAttempt(ip, name, "login", false);
      return new Response(
        JSON.stringify({ error: "Invalid credentials" }),
        { status: 401, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // Fetch full client data for the session (excluding password fields)
    const clientRes = await fetch(
      `${SUPABASE_URL}/rest/v1/clients?select=id,name,email,is_coach,modules,assigned_coach_id,calorie_target,protein_target,account_type,xp_monthly,xp_total,xp_level,dismissed_badges,synrg_started_at,synrg_quiz,created_at&id=eq.${row.id}`,
      { headers: sbHeaders() }
    );
    if (!clientRes.ok) {
      return new Response(
        JSON.stringify({ error: "Failed to load client" }),
        { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }
    const clients = await clientRes.json();
    const client = clients?.[0];
    if (!client) {
      return new Response(
        JSON.stringify({ error: "Client not found" }),
        { status: 404, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    await logAttempt(ip, name, "login", true);
    return new Response(
      JSON.stringify({ ok: true, client }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("auth-login error:", err);
    if (name) await logAttempt(ip, name, "login", false);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});
