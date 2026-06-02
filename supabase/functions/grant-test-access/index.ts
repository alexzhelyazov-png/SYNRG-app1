// ── grant-test-access ──────────────────────────────────────────────
// Lets the admin UI grant/revoke an ONLINE (SYNRG Method) test purchase
// to a registered client WITHOUT a real Stripe payment.
//
// RLS on program_purchases only allows service-role writes (anon can only
// SELECT), so the admin browser cannot insert directly — we proxy the
// write through this Edge Function using SUPABASE_SERVICE_ROLE_KEY.
//
// Body: { client_id: uuid, action: 'grant' | 'revoke', admin_secret: string }
// `admin_secret` must match the TEST_ACCESS_SECRET env var.
//
// On grant: upserts an active program_purchases row (amount 0, marked
// test_manual_*) valid for 8 weeks. The admin UI separately merges
// REMOTE_MODULES + account_type='online' on the clients row (anon can write
// clients), which also triggers coach auto-assignment client-side.
// On revoke: deletes the test purchase row(s) for this client + program.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const PROGRAM_DURATION_WEEKS = 8;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: cors });
  }

  let body: any;
  try { body = await req.json(); } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const clientId = (body.client_id || "").toString();
  const action = (body.action || "").toString();
  const secret = (body.admin_secret || "").toString();

  if (!clientId || (action !== "grant" && action !== "revoke")) {
    return json({ error: "Missing or invalid client_id/action" }, 400);
  }
  if (!secret || secret !== Deno.env.get("TEST_ACCESS_SECRET")) {
    return json({ error: "Unauthorized" }, 401);
  }

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  // Resolve the single online program (SYNRG Method = the one with a Stripe price).
  const { data: progs, error: progErr } = await sb
    .from("programs")
    .select("id,stripe_price_id,status,display_order")
    .eq("status", "active")
    .order("display_order", { ascending: true });
  if (progErr) return json({ error: progErr.message }, 500);
  const prog = (progs || []).find((p: any) => p.stripe_price_id) || (progs || [])[0];
  if (!prog) return json({ error: "No active online program found" }, 404);

  if (action === "revoke") {
    const { error } = await sb
      .from("program_purchases")
      .delete()
      .eq("client_id", clientId)
      .eq("program_id", prog.id);
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true, action: "revoke" });
  }

  // grant — upsert an active row (UNIQUE(client_id, program_id) is the conflict target)
  const validUntil = new Date(Date.now() + PROGRAM_DURATION_WEEKS * 7 * 24 * 60 * 60 * 1000)
    .toISOString().slice(0, 10);
  const { data, error } = await sb
    .from("program_purchases")
    .upsert({
      client_id: clientId,
      program_id: prog.id,
      stripe_session_id: `test_manual_${clientId.slice(0, 8)}`,
      amount_cents: 0,
      currency: "EUR",
      status: "active",
      payment_method: "stripe",
      valid_until: validUntil,
    }, { onConflict: "client_id,program_id" })
    .select()
    .single();
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, action: "grant", purchase: data });

  function json(payload: any, status = 200) {
    return new Response(JSON.stringify(payload), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
