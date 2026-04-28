import Stripe from "https://esm.sh/stripe@14.14.0?target=deno";

// Allowed origins (production + dev). Edit when domain changes.
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

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Early Bird campaign cap — first 100 customers get the discounted price.
// To disable cap: set this to 0 or remove the price metadata `campaign=early_bird_first_100`.
const EARLY_BIRD_CAP = 100;
const EARLY_BIRD_CAMPAIGN = "early_bird_first_100";

async function countActivePurchases(programId: string): Promise<number> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/program_purchases?select=id&program_id=eq.${programId}&status=eq.active`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        Prefer: "count=exact",
      },
    }
  );
  if (!res.ok) return 0;
  // Supabase returns count in Content-Range header: "0-N/total"
  const range = res.headers.get("content-range");
  if (range) {
    const total = parseInt(range.split("/")[1], 10);
    return isNaN(total) ? 0 : total;
  }
  const data = await res.json();
  return Array.isArray(data) ? data.length : 0;
}

async function getPriceCampaign(stripe: Stripe, priceId: string): Promise<string | null> {
  try {
    const price = await stripe.prices.retrieve(priceId);
    return (price.metadata?.campaign as string) || null;
  } catch (e) {
    console.error("Failed to retrieve price metadata:", e);
    return null;
  }
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const cors = corsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  try {
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
      apiVersion: "2023-10-16",
    });

    const { line_items, success_url, cancel_url, locale, metadata } = await req.json();

    if (!line_items || !line_items.length) {
      return new Response(
        JSON.stringify({ error: "No line items provided" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // Validate success/cancel URLs are on allowed domain (prevent open redirect)
    const validateUrl = (url: string) => {
      try {
        const u = new URL(url);
        return ALLOWED_ORIGINS.some(o => u.origin === o);
      } catch { return false; }
    };
    if (!validateUrl(success_url) || !validateUrl(cancel_url)) {
      return new Response(
        JSON.stringify({ error: "Invalid success_url or cancel_url" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // ── Early Bird cap enforcement ──────────────────────────────
    // If price has metadata.campaign='early_bird_first_100', enforce 100-customer cap
    const programId = metadata?.program_id;
    const priceId = line_items[0]?.price;
    if (programId && priceId) {
      const campaign = await getPriceCampaign(stripe, priceId);
      if (campaign === EARLY_BIRD_CAMPAIGN && EARLY_BIRD_CAP > 0) {
        const currentCount = await countActivePurchases(programId);
        if (currentCount >= EARLY_BIRD_CAP) {
          return new Response(
            JSON.stringify({
              error: "campaign_ended",
              message: "Early bird campaign has ended (first 100 sold)",
            }),
            { status: 409, headers: { ...cors, "Content-Type": "application/json" } }
          );
        }
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items,
      success_url,
      cancel_url,
      locale: locale === "en" ? "en" : "bg",
      metadata: metadata || {},
    });

    return new Response(
      JSON.stringify({ url: session.url }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Stripe checkout error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});
