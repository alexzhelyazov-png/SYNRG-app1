/**
 * Supabase Edge Function: Stripe Webhook
 *
 * Handles checkout.session.completed events:
 * 1. Records the purchase in program_purchases
 * 2. Grants app modules to the client (all except booking & studio)
 */

import Stripe from "https://esm.sh/stripe@14.14.0?target=deno";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function sbHeaders() {
  return {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
}

async function sbQuery(table: string, params: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${params}`, {
    headers: sbHeaders(),
  });
  if (!res.ok) return null;
  return res.json();
}

async function sbInsert(table: string, row: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: { ...sbHeaders(), Prefer: "return=representation,resolution=ignore-duplicates" },
    body: JSON.stringify(row),
  });
  if (!res.ok) {
    console.error(`Insert ${table} failed:`, await res.text());
    return null;
  }
  const data = await res.json();
  return Array.isArray(data) ? data[0] : data;
}

async function sbPatch(table: string, id: string, patch: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: "PATCH",
    headers: sbHeaders(),
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    console.error(`Patch ${table} failed:`, await res.text());
  }
}

// Modules granted to remote clients on program purchase
// All except booking_access and studio_access
const REMOTE_MODULES = [
  "program_access",
  "weight_tracking",
  "nutrition_tracking",
  "training_plan_access",
  "planner_access",
];

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
      apiVersion: "2023-10-16",
    });

    const body = await req.text();
    const sig = req.headers.get("stripe-signature");

    // Verify webhook signature if endpoint secret is configured
    const endpointSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    let event: Stripe.Event;

    if (endpointSecret && sig) {
      event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
    } else {
      // Fallback: parse without verification (dev mode)
      event = JSON.parse(body);
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const { client_id, program_id } = session.metadata || {};

      if (!client_id || !program_id) {
        console.warn("Webhook: missing metadata", session.metadata);
        return new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      console.log(`Processing purchase: client=${client_id}, program=${program_id}`);

      // 1. Record purchase
      await sbInsert("program_purchases", {
        client_id,
        program_id,
        stripe_session_id: session.id,
        amount_cents: session.amount_total || 0,
        currency: (session.currency || "bgn").toUpperCase(),
        status: "active",
      });

      // 2. Get current client modules
      const clients = await sbQuery("clients", `?select=modules&id=eq.${client_id}`);
      const currentModules: string[] = clients?.[0]?.modules || [];

      // 3. Merge remote modules (don't duplicate, don't override existing)
      const merged = [...new Set([...currentModules, ...REMOTE_MODULES])];

      // 4. Update client modules if changed
      if (merged.length !== currentModules.length) {
        await sbPatch("clients", client_id, { modules: merged });
        console.log(`Updated modules for client ${client_id}:`, merged);
      }

      console.log(`Purchase recorded for client ${client_id}, program ${program_id}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Stripe webhook error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
});
