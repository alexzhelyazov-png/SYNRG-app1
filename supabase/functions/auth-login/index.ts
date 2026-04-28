/**
 * Supabase Edge Function: auth-login
 *
 * Verifies client password server-side using bcrypt (via Postgres crypt()).
 * Replaces client-side password comparison which exposed plaintext passwords
 * to anyone with the anon key.
 *
 * Returns full client data (excluding password_hash) on success.
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const cors = corsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: cors });
  }

  try {
    const { name, password } = await req.json();
    if (!name || !password) {
      return new Response(
        JSON.stringify({ error: "name and password required" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // Verify password via Postgres RPC (uses crypt() for bcrypt comparison)
    const verifyRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/verify_client_password`, {
      method: "POST",
      headers: sbHeaders(),
      body: JSON.stringify({ p_name: name, p_password: password }),
    });
    const verifyData = await verifyRes.json();
    const row = Array.isArray(verifyData) ? verifyData[0] : verifyData;

    if (!row || !row.valid) {
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

    return new Response(
      JSON.stringify({ ok: true, client }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("auth-login error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});
