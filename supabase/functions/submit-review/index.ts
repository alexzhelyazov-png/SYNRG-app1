/**
 * Supabase Edge Function: submit-review
 *
 * Allows VERIFIED BUYERS to submit a review for a program they purchased.
 * Reviews start as 'pending' and require admin approval before public display.
 *
 * Verification: client must have a record in program_purchases for this program
 * (status active, refunded, or expired — completed program owners can review too).
 *
 * One review per (client, program) — UPDATE if existing.
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
  };
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const cors = corsHeaders(origin);

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { client_id, program_id, rating, text } = await req.json();

    if (!client_id || !program_id || !rating) {
      return new Response(
        JSON.stringify({ error: "client_id, program_id, rating required" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }
    const r = Number(rating);
    if (!Number.isInteger(r) || r < 1 || r > 5) {
      return new Response(
        JSON.stringify({ error: "Rating must be integer 1-5" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // Verify buyer: client must have purchase for this program
    const purchRes = await fetch(
      `${SUPABASE_URL}/rest/v1/program_purchases?select=id,status&client_id=eq.${client_id}&program_id=eq.${program_id}&limit=1`,
      { headers: sbHeaders() }
    );
    const purchases = await purchRes.json();
    if (!Array.isArray(purchases) || purchases.length === 0) {
      return new Response(
        JSON.stringify({ error: "verified_buyer_only", message: "Само клиенти които са закупили програмата могат да оставят ревю." }),
        { status: 403, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // Get client name (for display)
    const clientRes = await fetch(
      `${SUPABASE_URL}/rest/v1/clients?select=name&id=eq.${client_id}&limit=1`,
      { headers: sbHeaders() }
    );
    const clients = await clientRes.json();
    const clientName = clients?.[0]?.name || "Клиент";

    // Upsert review (one per client+program)
    const upsertRes = await fetch(
      `${SUPABASE_URL}/rest/v1/program_reviews?on_conflict=client_id,program_id`,
      {
        method: "POST",
        headers: { ...sbHeaders(), Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify({
          client_id,
          program_id,
          rating: r,
          text: (text || "").trim().slice(0, 1000) || null,
          client_name: clientName,
          status: "pending",
        }),
      }
    );

    if (!upsertRes.ok) {
      const errText = await upsertRes.text();
      console.error("Review upsert failed:", errText);
      return new Response(
        JSON.stringify({ error: "Failed to save review" }),
        { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }
    const data = await upsertRes.json();
    const review = Array.isArray(data) ? data[0] : data;

    return new Response(
      JSON.stringify({ ok: true, review, message: "Ревюто е изпратено за одобрение от админ. Ще се покаже публично след преглед." }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("submit-review error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});
