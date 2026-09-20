/**
 * Supabase Edge Function: push-subscribe
 *
 * Registers / removes a Web Push subscription for a client.
 * Called from the browser with the anon key (deployed --no-verify-jwt, because
 * the anon key is the `sb_publishable_` format, not a JWT).
 *
 * POST { client_id, subscription: {endpoint, keys:{p256dh, auth}}, platform, standalone, user_agent }
 * POST { action: "unsubscribe", endpoint }
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ALLOWED_ORIGINS = [
  "https://synrg-beyondfitness.com",
  "https://www.synrg-beyondfitness.com",
  "https://aleksandarzhelyazov.github.io",
  "http://localhost:5173",
  "http://localhost:3000",
];
function cors(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}
const sbHeaders = () => ({
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
});

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const h = { ...cors(origin), "Content-Type": "application/json" };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: h });

  try {
    const body = await req.json();

    if (body.action === "unsubscribe") {
      if (!body.endpoint) return new Response(JSON.stringify({ error: "endpoint required" }), { status: 400, headers: h });
      await fetch(
        `${SUPABASE_URL}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(body.endpoint)}`,
        { method: "DELETE", headers: { ...sbHeaders(), Prefer: "return=minimal" } },
      );
      return new Response(JSON.stringify({ ok: true }), { headers: h });
    }

    const { client_id, subscription, platform, standalone, user_agent } = body;
    if (!client_id || !subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return new Response(JSON.stringify({ error: "client_id and full subscription required" }), { status: 400, headers: h });
    }

    // Upsert on endpoint: re-subscribing the same device must not pile up rows,
    // and a device that changed hands re-points to the new client_id.
    const res = await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?on_conflict=endpoint`, {
      method: "POST",
      headers: { ...sbHeaders(), Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({
        client_id,
        endpoint:   subscription.endpoint,
        p256dh:     subscription.keys.p256dh,
        auth:       subscription.keys.auth,
        platform:   platform   || null,
        standalone: standalone ?? null,
        user_agent: (user_agent || "").slice(0, 400) || null,
        last_seen_at: new Date().toISOString(),
        fail_count: 0,
        disabled_at: null,
      }),
    });
    if (!res.ok) {
      const txt = await res.text();
      console.error("push-subscribe upsert failed:", txt);
      return new Response(JSON.stringify({ error: "store_failed" }), { status: 500, headers: h });
    }
    return new Response(JSON.stringify({ ok: true }), { headers: h });
  } catch (err) {
    console.error("push-subscribe error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: h });
  }
});
