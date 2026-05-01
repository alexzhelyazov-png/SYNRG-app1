// ── moderate-review ────────────────────────────────────────────────
// Lets the admin UI flip program_reviews.status between
// 'pending' / 'approved' / 'rejected'.  RLS on the table only allows
// service-role writes, so we proxy the UPDATE through this Edge
// Function which uses SUPABASE_SERVICE_ROLE_KEY.
//
// Body: { id: uuid, status: 'approved' | 'rejected' | 'pending', admin_secret: string }
// `admin_secret` must match the MODERATE_REVIEW_SECRET env var so random
// callers can't toggle reviews.  The admin UI hard-codes the secret in
// localStorage / fetch headers — fine for a small studio, low surface.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const ALLOWED = new Set(["pending", "approved", "rejected"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: cors });
  }

  let body: any;
  try { body = await req.json(); } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const id = (body.id || "").toString();
  const status = (body.status || "").toString();
  const secret = (body.admin_secret || "").toString();

  if (!id || !ALLOWED.has(status)) {
    return json({ error: "Missing or invalid id/status" }, 400);
  }
  if (!secret || secret !== Deno.env.get("MODERATE_REVIEW_SECRET")) {
    return json({ error: "Unauthorized" }, 401);
  }

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  const { data, error } = await sb
    .from("program_reviews")
    .update({ status, reviewed_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, review: data });

  function json(payload: any, status = 200) {
    return new Response(JSON.stringify(payload), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
