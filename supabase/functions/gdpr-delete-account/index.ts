/**
 * Supabase Edge Function: GDPR Account Deletion
 *
 * Implements GDPR Art. 17 — right to be forgotten.
 * Hard-deletes a client's data across all related tables.
 *
 * Auth: requires (client_id + current password) to prevent abuse.
 * Returns 200 with summary of deleted rows on success.
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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
    Prefer: "return=minimal",
  };
}

async function sbDelete(table: string, filter: string): Promise<number> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: "DELETE",
    headers: { ...sbHeaders(), Prefer: "count=exact,return=minimal" },
  });
  if (!res.ok) {
    console.error(`Delete ${table} failed:`, await res.text());
    return 0;
  }
  const range = res.headers.get("content-range");
  if (range) {
    const total = parseInt(range.split("/")[1], 10);
    return isNaN(total) ? 0 : total;
  }
  return 0;
}

async function sbQuery(table: string, params: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${params}`, {
    headers: sbHeaders(),
  });
  if (!res.ok) return null;
  return res.json();
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
    const { client_id, password } = await req.json();
    if (!client_id || !password) {
      return new Response(
        JSON.stringify({ error: "client_id and password required" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // Verify password (using current plain-text storage; will work after bcrypt migration too if we update this)
    const clients = await sbQuery("clients", `?select=id,password,password_hash&id=eq.${client_id}`);
    const client = (clients as Array<{ id: string; password?: string; password_hash?: string }>)?.[0];
    if (!client) {
      return new Response(
        JSON.stringify({ error: "Client not found" }),
        { status: 404, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // Check password — prefer hash if present, fall back to plain
    let valid = false;
    if (client.password_hash) {
      // bcrypt compare via Deno (lazy import only when needed)
      const bcrypt = await import("https://deno.land/x/bcrypt@v0.4.1/mod.ts");
      valid = await bcrypt.compare(password, client.password_hash);
    } else {
      valid = client.password === password;
    }
    if (!valid) {
      return new Response(
        JSON.stringify({ error: "Invalid password" }),
        { status: 403, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // Delete from all tables that reference client_id
    // Order matters: delete dependent rows first
    const summary: Record<string, number> = {};
    const tables = [
      "meals",
      "weight_logs",
      "steps_logs",
      "workouts",
      "tasks",
      "coach_messages",
      "post_comments",
      "post_reactions",
      "community_posts",
      "notifications",
      "client_plans",
      "client_program_progress",
      "client_resource_progress",
      "program_purchases",
      "password_resets",
      "food_recognize_quota",
    ];
    for (const t of tables) {
      summary[t] = await sbDelete(t, `client_id=eq.${client_id}`);
    }

    // Finally delete the client itself
    summary.clients = await sbDelete("clients", `id=eq.${client_id}`);

    console.log(`GDPR delete completed for client ${client_id}:`, summary);

    return new Response(
      JSON.stringify({ ok: true, summary }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("GDPR delete error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});
