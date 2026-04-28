/**
 * Supabase Edge Function: submit-review
 *
 * Two submission modes:
 *
 * 1. VERIFIED BUYER (app users)
 *    Body: { client_id, program_id, rating, text }
 *    Requires the client to have a record in program_purchases for this program.
 *    Reviews are upserted (one per client+program).
 *
 * 2. PUBLIC (anyone — incl. former studio clients without an account)
 *    Body: { name, rating, text, category, turnstile_token }
 *    Protected by Cloudflare Turnstile. Inserts a new pending review with
 *    client_id=null, client_name=<name>, program_id=null, status='pending'.
 *    `category` is optional ('studio' | 'online'); we store it as a prefix in
 *    client_name so the admin moderation UI can quickly tell them apart.
 *
 * All reviews start as 'pending' and require admin approval before public display.
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
  "http://localhost:3030",
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

async function verifyTurnstile(token: string, ip: string | null): Promise<boolean> {
  if (!TURNSTILE_SECRET) {
    console.warn("TURNSTILE_SECRET_KEY not configured — accepting request without verification");
    return true;
  }
  try {
    const form = new URLSearchParams();
    form.append("secret", TURNSTILE_SECRET);
    form.append("response", token);
    if (ip) form.append("remoteip", ip);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
    const data = await res.json();
    return !!data.success;
  } catch (err) {
    console.error("Turnstile verify error:", err);
    return false;
  }
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const cors = corsHeaders(origin);

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const body = await req.json();
    const { client_id, program_id, rating, text } = body;
    const r = Number(rating);

    if (!Number.isInteger(r) || r < 1 || r > 5) {
      return new Response(
        JSON.stringify({ error: "Rating must be integer 1-5" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const cleanText = (text || "").toString().trim().slice(0, 1000) || null;

    // ── Path 1: VERIFIED BUYER (app user) ─────────────────────────────
    if (client_id && program_id) {
      // Verify buyer: client must have purchase for this program
      const purchRes = await fetch(
        `${SUPABASE_URL}/rest/v1/program_purchases?select=id,status&client_id=eq.${client_id}&program_id=eq.${program_id}&limit=1`,
        { headers: sbHeaders() }
      );
      const purchases = await purchRes.json();
      if (!Array.isArray(purchases) || purchases.length === 0) {
        return new Response(
          JSON.stringify({ error: "verified_buyer_only", message: "Само клиенти, които са закупили SYNRG Метод, могат да оставят ревю по този път." }),
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
            text: cleanText,
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
    }

    // ── Path 2: PUBLIC submission (no account required) ───────────────
    const name = (body.name || "").toString().trim().slice(0, 50);
    const category = (body.category || "general").toString().trim().toLowerCase();
    const turnstileToken = (body.turnstile_token || "").toString();

    if (!name || name.length < 2) {
      return new Response(
        JSON.stringify({ error: "Името е задължително (мин. 2 знака)." }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }
    if (!cleanText || cleanText.length < 10) {
      return new Response(
        JSON.stringify({ error: "Моля, напиши кратък отзив (мин. 10 знака)." }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }
    if (!turnstileToken) {
      return new Response(
        JSON.stringify({ error: "Липсва Turnstile верификация." }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const ip = req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for");
    const captchaOk = await verifyTurnstile(turnstileToken, ip);
    if (!captchaOk) {
      return new Response(
        JSON.stringify({ error: "Turnstile верификацията не премина. Моля, опитай отново." }),
        { status: 403, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // Encode category as prefix in client_name so the admin can filter quickly
    // without a schema migration. e.g. "[STUDIO] Иван П." or "[ONLINE] Мария К."
    const allowedCategories = new Set(["studio", "online", "general"]);
    const cat = allowedCategories.has(category) ? category : "general";
    const tag = cat === "studio" ? "[STUDIO] " : cat === "online" ? "[ONLINE] " : "";
    const storedName = (tag + name).slice(0, 100);

    const insertRes = await fetch(
      `${SUPABASE_URL}/rest/v1/program_reviews`,
      {
        method: "POST",
        headers: { ...sbHeaders(), Prefer: "return=representation" },
        body: JSON.stringify({
          client_id: null,
          program_id: null,
          rating: r,
          text: cleanText,
          client_name: storedName,
          status: "pending",
        }),
      }
    );

    if (!insertRes.ok) {
      const errText = await insertRes.text();
      console.error("Public review insert failed:", errText);
      return new Response(
        JSON.stringify({ error: "Failed to save review" }),
        { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }
    const data = await insertRes.json();
    const review = Array.isArray(data) ? data[0] : data;

    return new Response(
      JSON.stringify({ ok: true, review, message: "Благодарим ти! Ревюто ще се покаже публично след преглед." }),
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
