/**
 * Supabase Edge Function: auth-register
 *
 * Creates a new client with bcrypt-hashed password (no plaintext stored).
 * Returns the new client row (excluding password fields) on success.
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

  try {
    const body = await req.json();
    const { name, password, email } = body;

    if (!name || !password) {
      return new Response(
        JSON.stringify({ error: "name and password required" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }
    if (password.length < 4) {
      return new Response(
        JSON.stringify({ error: "Password too short" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // Check for existing user (case-insensitive)
    const existsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/clients?select=id&name=ilike.${encodeURIComponent(name)}&is_coach=eq.false`,
      { headers: sbHeaders() }
    );
    const existing = await existsRes.json();
    if (Array.isArray(existing) && existing.length > 0) {
      return new Response(
        JSON.stringify({ error: "Client already exists" }),
        { status: 409, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // Hash password via Postgres crypt() — same algorithm as login verification
    const hashRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/hash_password`, {
      method: "POST",
      headers: sbHeaders(),
      body: JSON.stringify({ p_password: password }),
    });
    const passwordHash = await hashRes.json();

    // Insert new client (password_hash only, no plaintext)
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

    return new Response(
      JSON.stringify({ ok: true, client }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("auth-register error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});
