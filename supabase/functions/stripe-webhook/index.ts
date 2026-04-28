/**
 * Supabase Edge Function: Stripe Webhook
 *
 * Handles:
 * - checkout.session.completed → records purchase, grants modules, assigns coach, sends email
 * - charge.refunded            → marks purchase refunded, revokes modules
 * - charge.dispute.created     → marks purchase disputed, suspends modules
 *
 * Idempotency: stripe_session_id has UNIQUE constraint. Duplicate retries detected and short-circuited.
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

async function sbPatch(table: string, idOrFilter: string, patch: Record<string, unknown>) {
  // idOrFilter can be "uuid" (treated as id=eq.uuid) or "field=op.value" for custom filter
  const filter = idOrFilter.includes("=") ? idOrFilter : `id=eq.${idOrFilter}`;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: "PATCH",
    headers: sbHeaders(),
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    console.error(`Patch ${table} failed:`, await res.text());
  }
}

// Modules granted to online clients on program purchase.
// CRITICAL: synrg_method MUST be included or purchasers can't access what they paid for.
// Excludes booking_access and studio_access (those are for in-person studio clients).
const REMOTE_MODULES = [
  "synrg_method",
  "program_access",
  "weight_tracking",
  "nutrition_tracking",
  "training_plan_access",
  "planner_access",
];

// Free modules (after program ends or refund) — baseline freemium access.
const FREE_MODULES = ["nutrition_tracking", "weight_tracking", "steps_tracking"];

// Program duration: 8 weeks. Auto-revoke modules after this period.
const PROGRAM_DURATION_WEEKS = 8;

const ADMIN_ALERT_EMAILS = ["aleksandarzhelyazov@gmail.com"];

async function sendPurchaseEmail(clientEmail: string, clientName: string, amountTotal: number | null, currency: string, retries = 3): Promise<boolean> {
  const amountDisplay = amountTotal
    ? (amountTotal / 100).toFixed(0) + " " + currency.toUpperCase()
    : "";
  const html = `<div style="font-family:sans-serif;padding:24px;background:#1a1a1a;color:#e0e0e0;border-radius:16px;max-width:520px">`
    + `<h2 style="color:#c4e9bf;margin:0 0 16px">Успешна покупка!</h2>`
    + `<p>Здравей, <strong>${clientName}</strong>!</p>`
    + `<p>Плащането ти е потвърдено${amountDisplay ? " (" + amountDisplay + ")" : ""}.</p>`
    + `<p>Достъпът до програмата е активиран. Отвори приложението и ще намериш съдържанието в секция <strong>Програми</strong>.</p>`
    + `<hr style="border:none;border-top:1px solid #333;margin:20px 0">`
    + `<p style="font-size:12px;color:#666">SYNRG Beyond Fitness</p></div>`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/mailerlite-sync`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY") || ""}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "send_email",
          email: clientEmail,
          name: clientName,
          fields: {},
          subject: "Успешна покупка — SYNRG Beyond Fitness",
          html,
        }),
      });
      if (res.ok) return true;
      console.warn(`Email attempt ${attempt} failed status:`, res.status);
    } catch (e) {
      console.warn(`Email attempt ${attempt} threw:`, e);
    }
    if (attempt < retries) await new Promise(r => setTimeout(r, 1000 * attempt));
  }
  return false;
}

async function assignCoach(clientId: string, clientName: string): Promise<{ ok: boolean; coachName?: string }> {
  try {
    // Get active coaches dynamically (replaces hardcoded IDs)
    const coaches = await sbQuery(
      "clients",
      `?select=id,name,is_active&role=eq.coach&is_active=eq.true&order=name.asc`
    );
    let candidates = (coaches || []) as Array<{ id: string; name: string; is_active: boolean }>;
    // Fallback to hardcoded IDs if coaches table is empty/role column missing
    if (!candidates.length) {
      candidates = [
        { id: "1b0a54a2-22c0-49b6-8083-8ed6356e29d2", name: "Елина", is_active: true },
        { id: "4ce4ed28-1b4c-4a57-8d22-d02a402f45ac", name: "Ицко", is_active: true },
      ];
    }
    if (!candidates.length) return { ok: false };

    // Count synrg_method clients per coach to balance
    const allSynrg = await sbQuery(
      "clients",
      `?select=assigned_coach_id&modules=cs.${encodeURIComponent('["synrg_method"]')}`
    ) || [];
    const counts: Record<string, number> = {};
    for (const c of (allSynrg as Array<{ assigned_coach_id: string }>)) {
      if (c.assigned_coach_id) counts[c.assigned_coach_id] = (counts[c.assigned_coach_id] || 0) + 1;
    }

    // Pick coach with fewest assigned clients
    const picked = candidates.reduce((min, c) =>
      (counts[c.id] || 0) < (counts[min.id] || 0) ? c : min
    , candidates[0]);

    await sbPatch("clients", clientId, { assigned_coach_id: picked.id });

    // Welcome message — wrapped in try so it doesn't fail the whole assignment
    try {
      await sbInsert("coach_messages", {
        client_id: clientId,
        coach_id: picked.id,
        sender_role: "coach",
        sender_name: picked.name,
        text: `Здравей, ${clientName}! Аз съм ${picked.name}, твоят ментор в SYNRG Метод. Добре дошъл/дошла! Имаш 2 check-in сесии на месец — пиши ми тук когато имаш въпроси или се нуждаеш от корекция на програмата.`,
      });
    } catch (e) { console.warn("Welcome message failed:", e); }

    return { ok: true, coachName: picked.name };
  } catch (e) {
    console.error("Coach assignment failed:", e);
    return { ok: false };
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const { client_id, program_id } = session.metadata || {};
  if (!client_id || !program_id) {
    console.warn("Webhook: missing metadata", session.metadata);
    return;
  }

  // Idempotency check — short-circuit if already processed
  const existing = await sbQuery("program_purchases", `?select=id&stripe_session_id=eq.${session.id}`);
  if (existing && (existing as Array<unknown>).length > 0) {
    console.log(`Webhook: session ${session.id} already processed, skipping`);
    return;
  }

  console.log(`Processing purchase: client=${client_id}, program=${program_id}`);

  // ── Race condition guard: re-check Early Bird cap inside webhook (atomic with insert) ──
  // The frontend create-checkout-session does a TOCTOU check, but two concurrent purchases
  // can both pass it. We re-verify here before granting access.
  try {
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2023-10-16" });
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 5 });
    const priceId = lineItems.data[0]?.price?.id;
    if (priceId) {
      const price = await stripe.prices.retrieve(priceId);
      if (price.metadata?.campaign === "early_bird_first_100") {
        const activeRes = await fetch(
          `${SUPABASE_URL}/rest/v1/program_purchases?select=id&program_id=eq.${program_id}&status=eq.active`,
          { headers: { ...sbHeaders(), Prefer: "count=exact" } }
        );
        const range = activeRes.headers.get("content-range");
        const total = range ? parseInt(range.split("/")[1], 10) : 0;
        if (total >= 100) {
          console.warn(`Early Bird cap exceeded — purchase ${session.id} would be #${total + 1}. Refunding.`);
          // Auto-refund via Stripe (so customer isn't charged for unavailable spot)
          if (session.payment_intent) {
            await stripe.refunds.create({ payment_intent: session.payment_intent as string, reason: "duplicate" });
          }
          // Notify admin
          await sendAdminAlert(`Early Bird cap race condition triggered — refunded ${session.id}`, `Customer attempted purchase but cap was full. Auto-refunded.`);
          return;
        }
      }
    }
  } catch (e) {
    console.warn("Cap re-check failed (allowing through):", e);
  }

  // Calculate program expiry (8 weeks from now)
  const validUntil = new Date(Date.now() + PROGRAM_DURATION_WEEKS * 7 * 24 * 60 * 60 * 1000)
    .toISOString().slice(0, 10);

  // 1. Record purchase (UNIQUE constraint on stripe_session_id will reject duplicates)
  const inserted = await sbInsert("program_purchases", {
    client_id,
    program_id,
    stripe_session_id: session.id,
    amount_cents: session.amount_total || 0,
    currency: (session.currency || "eur").toUpperCase(),
    status: "active",
    valid_until: validUntil,
  });
  if (!inserted) {
    console.error(`Failed to insert purchase for session ${session.id}`);
    return;
  }

  // 2. Get client + merge modules
  const clients = await sbQuery("clients", `?select=modules,email,name,assigned_coach_id&id=eq.${client_id}`);
  const clientRow = (clients as Array<Record<string, unknown>>)?.[0];
  if (!clientRow) {
    console.error(`Client ${client_id} not found`);
    return;
  }
  const currentModules: string[] = (clientRow.modules as string[]) || [];
  const merged = [...new Set([...currentModules, ...REMOTE_MODULES])];

  const modulesChanged = merged.length !== currentModules.length;
  await sbPatch("clients", client_id, {
    ...(modulesChanged ? { modules: merged } : {}),
    account_type: "online",
  });
  if (modulesChanged) console.log(`Updated modules for client ${client_id}:`, merged);

  // 3. Auto-assign coach if synrg_method active and no coach yet
  if (merged.includes("synrg_method") && !clientRow.assigned_coach_id) {
    const result = await assignCoach(client_id, (clientRow.name as string) || "клиент");
    if (result.ok) {
      console.log(`Auto-assigned coach ${result.coachName} to client ${client_id}`);
    } else {
      console.error(`COACH ASSIGNMENT FAILED for client ${client_id} — admin alert needed`);
      // Mark purchase for admin attention
      await sbPatch("program_purchases", `stripe_session_id=eq.${session.id}`, { status: "needs_coach" });
    }
  }

  // 4. Send confirmation email with retry
  const clientEmail = clientRow.email as string;
  const clientName = (clientRow.name as string) || "клиент";
  if (clientEmail) {
    const sent = await sendPurchaseEmail(clientEmail, clientName, session.amount_total, session.currency || "eur");
    if (!sent) {
      console.error(`EMAIL FAILED for client ${client_id} after retries`);
      // Don't fail the webhook — email failure shouldn't trigger Stripe retry
    }
  }

  console.log(`Purchase recorded for client ${client_id}, program ${program_id}`);
}

// Generic email sender (uses mailerlite-sync function which talks to Brevo)
async function sendEmail(to: string, name: string, subject: string, html: string): Promise<boolean> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/mailerlite-sync`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY") || ""}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "send_email",
        email: to,
        name,
        fields: {},
        subject,
        html,
      }),
    });
    return res.ok;
  } catch (e) {
    console.warn("sendEmail failed:", e);
    return false;
  }
}

async function sendAdminAlert(subject: string, body: string) {
  const html = `<div style="font-family:sans-serif;padding:20px;max-width:560px"><h2 style="color:#d33">[SYNRG ADMIN] ${subject}</h2><p>${body}</p><p style="font-size:11px;color:#999">Auto-generated from Stripe webhook.</p></div>`;
  for (const email of ADMIN_ALERT_EMAILS) {
    await sendEmail(email, "Admin", `[SYNRG] ${subject}`, html);
  }
}

async function handleRefund(charge: Stripe.Charge) {
  const sessionId = charge.metadata?.checkout_session_id || (charge.payment_intent as string);
  const purchases = await sbQuery(
    "program_purchases",
    `?select=id,client_id,program_id&or=(stripe_session_id.eq.${sessionId},stripe_session_id.eq.${charge.payment_intent})`
  );
  const purchase = (purchases as Array<{ id: string; client_id: string; program_id: string }>)?.[0];
  if (!purchase) {
    console.warn(`Refund: no purchase found for charge ${charge.id}`);
    return;
  }

  await sbPatch("program_purchases", purchase.id, { status: "refunded", refunded_at: new Date().toISOString() });

  // Revoke modules → FREE_MODULES
  await sbPatch("clients", purchase.client_id, {
    modules: FREE_MODULES,
    account_type: "free",
  });

  // Get client info for email
  const clientRows = await sbQuery("clients", `?select=email,name&id=eq.${purchase.client_id}`);
  const client = (clientRows as Array<{ email: string; name: string }>)?.[0];

  if (client?.email) {
    const refundAmount = charge.amount_refunded ? (charge.amount_refunded / 100).toFixed(0) + " " + (charge.currency?.toUpperCase() || "EUR") : "";
    const html = `<div style="font-family:sans-serif;padding:24px;background:#1a1a1a;color:#e0e0e0;border-radius:16px;max-width:520px">`
      + `<h2 style="color:#c4e9bf;margin:0 0 16px">Възстановяване на сума</h2>`
      + `<p>Здравей, <strong>${client.name || "клиент"}</strong>!</p>`
      + `<p>Потвърждаваме, че сумата ${refundAmount ? `от <strong>${refundAmount}</strong> ` : ""}за програмата SYNRG Метод беше възстановена.</p>`
      + `<p>Парите ще се появят в банковата ти сметка в рамките на 5-10 работни дни (зависи от банката).</p>`
      + `<p>Достъпът ти до програмата е прекратен. Безплатните модули (хранене, тегло, стъпки) остават активни.</p>`
      + `<p>Ако имаш въпроси — отговори на този имейл.</p>`
      + `<hr style="border:none;border-top:1px solid #333;margin:20px 0">`
      + `<p style="font-size:12px;color:#666">SYNRG Beyond Fitness · Синерджи 93 ООД</p></div>`;
    await sendEmail(client.email, client.name || "клиент", "Възстановяване на сума — SYNRG", html);
  }

  await sendAdminAlert(`Refund processed`, `Purchase ${purchase.id} for client ${purchase.client_id} refunded. Modules revoked.`);
  console.log(`Refunded purchase ${purchase.id}, revoked modules for client ${purchase.client_id}`);
}

async function handleDispute(dispute: Stripe.Dispute) {
  const charge = dispute.charge as string;
  const purchases = await sbQuery(
    "program_purchases",
    `?select=id,client_id&stripe_session_id=eq.${charge}`
  );
  const purchase = (purchases as Array<{ id: string; client_id: string }>)?.[0];
  if (!purchase) {
    console.warn(`Dispute: no purchase found for charge ${charge}`);
    await sendAdminAlert(`Dispute opened — no purchase found`, `Charge: ${charge}, Dispute: ${dispute.id}, Reason: ${dispute.reason}. Investigate manually.`);
    return;
  }

  await sbPatch("program_purchases", purchase.id, {
    status: "disputed",
    disputed_at: new Date().toISOString(),
  });

  // CRITICAL: Revoke modules during dispute (prevents fraudster from keeping access)
  await sbPatch("clients", purchase.client_id, {
    modules: FREE_MODULES,
    account_type: "free",
  });

  // Email admin urgently
  const clientRows = await sbQuery("clients", `?select=email,name&id=eq.${purchase.client_id}`);
  const client = (clientRows as Array<{ email: string; name: string }>)?.[0];
  await sendAdminAlert(
    `URGENT: Chargeback dispute opened`,
    `Purchase ${purchase.id} for client ${purchase.client_id} (${client?.name || "?"} / ${client?.email || "no email"}) is disputed. ` +
    `Reason: ${dispute.reason}. Stripe dispute ID: ${dispute.id}. ` +
    `Modules have been auto-revoked. You have ~7 days to respond to Stripe dispute or you lose by default.`
  );
  console.error(`DISPUTE: purchase ${purchase.id}, client ${purchase.client_id} — modules revoked, admin alerted`);
}

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
    const endpointSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

    // Hard requirement: signature verification (no fallback)
    if (!endpointSecret) {
      console.error("STRIPE_WEBHOOK_SECRET not configured");
      return new Response(JSON.stringify({ error: "Webhook secret not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (!sig) {
      console.error("Missing stripe-signature header");
      return new Response(JSON.stringify({ error: "Missing signature" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
    } catch (err) {
      console.error("Signature verification failed:", err.message);
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case "charge.refunded":
        await handleRefund(event.data.object as Stripe.Charge);
        break;
      case "charge.dispute.created":
        await handleDispute(event.data.object as Stripe.Dispute);
        break;
      default:
        console.log(`Ignoring event type: ${event.type}`);
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
