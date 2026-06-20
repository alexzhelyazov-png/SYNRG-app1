/**
 * Supabase Edge Function: activate-cod-order
 *
 * Called from the /start page on the website when the buyer scans the QR
 * on the postcard inside their envelope. Inputs:
 *   - email (the one entered at order time)
 *   - password (chosen now)
 *   - optional phone (fallback if the buyer mistyped their email at order)
 *
 * Flow:
 *   1. Find a pending_delivery CoD order by activation_email.
 *      Fallback: if not found, try by shipping_phone.
 *   2. Materialise the clients row:
 *        - If a clients row already exists with this email → reuse it,
 *          set password, set name from shipping_name if blank.
 *        - Otherwise create a new one with name=shipping_name.
 *        - Resolve name collisions by appending the first 4 chars of the
 *          phone (e.g. "Иван Петров (1234)").
 *   3. Link client_id on the order; flip status='active',
 *      fulfillment_status='delivered', delivered_at=now.
 *   4. Grant REMOTE_MODULES, assign coach, generate invoice — same as the
 *      Stripe webhook does for an online purchase.
 *   5. Return { ok:true, login_name } so the page can tell the user which
 *      name to use when logging in.
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
];

const REMOTE_MODULES = [
  "synrg_method",
  "program_access",
  "weight_tracking",
  "nutrition_tracking",
  "training_plan_access",
  "planner_access",
];

const PROGRAM_DURATION_WEEKS = 8;

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

function getIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

function normalizeBgPhone(raw: string): string | null {
  const digits = raw.replace(/[\s\-()]/g, "");
  let body = digits;
  if (body.startsWith("+359")) body = body.slice(4);
  else if (body.startsWith("00359")) body = body.slice(5);
  else if (body.startsWith("359")) body = body.slice(3);
  else if (body.startsWith("0")) body = body.slice(1);
  if (!/^[89]\d{8}$/.test(body)) return null;
  return "+359" + body;
}

function isValidEmail(raw: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw);
}

async function verifyTurnstile(token: string | null, ip: string): Promise<boolean> {
  if (!TURNSTILE_SECRET || !token) return true;
  try {
    const formData = new FormData();
    formData.append("secret", TURNSTILE_SECRET);
    formData.append("response", token);
    formData.append("remoteip", ip);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST", body: formData,
    });
    const data = await res.json();
    if (!data.success) console.warn("[turnstile] failed:", data["error-codes"]);
    return true;
  } catch { return true; }
}

async function isRateLimited(ip: string): Promise<boolean> {
  try {
    const cutoff1h = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/auth_attempts?select=created_at&ip=eq.${encodeURIComponent(ip)}&action=eq.activate_cod_order&created_at=gte.${cutoff1h}&limit=20`,
      { headers: sbHeaders() }
    );
    if (res.ok) {
      const recent = await res.json() as Array<unknown>;
      return recent.length >= 10; // Stricter than orders — guessing protection
    }
  } catch (e) { console.warn("Rate limit check failed:", e); }
  return false;
}

async function logAttempt(ip: string, identifier: string, success: boolean) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/auth_attempts`, {
      method: "POST",
      headers: { ...sbHeaders(), Prefer: "return=minimal" },
      body: JSON.stringify({ ip, name: identifier, action: "activate_cod_order", success }),
    });
  } catch (e) { console.warn("Log attempt failed:", e); }
}

interface PendingOrder {
  id: string;
  shipping_name: string;
  shipping_phone: string;
  shipping_address: string;
  activation_email: string;
  amount_cents: number;
  currency: string;
}

async function findPendingOrder(email: string, phone: string | null): Promise<PendingOrder | null> {
  // Try email first (case-insensitive).
  let res = await fetch(
    `${SUPABASE_URL}/rest/v1/program_purchases?select=id,shipping_name,shipping_phone,shipping_address,activation_email,amount_cents,currency&payment_method=eq.cod&status=eq.pending_delivery&activation_email=ilike.${encodeURIComponent(email)}&order=created_at.desc&limit=1`,
    { headers: sbHeaders() }
  );
  if (res.ok) {
    const rows = await res.json() as Array<PendingOrder>;
    if (rows.length > 0) return rows[0];
  }
  // Fallback to phone if provided.
  if (phone) {
    res = await fetch(
      `${SUPABASE_URL}/rest/v1/program_purchases?select=id,shipping_name,shipping_phone,shipping_address,activation_email,amount_cents,currency&payment_method=eq.cod&status=eq.pending_delivery&shipping_phone=eq.${encodeURIComponent(phone)}&order=created_at.desc&limit=1`,
      { headers: sbHeaders() }
    );
    if (res.ok) {
      const rows = await res.json() as Array<PendingOrder>;
      if (rows.length > 0) return rows[0];
    }
  }
  return null;
}

async function hashPassword(plain: string): Promise<string | null> {
  // Uses the same Postgres `hash_password` RPC as auth-register so the
  // resulting hash is compatible with auth-login verification.
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/hash_password`, {
      method: "POST",
      headers: sbHeaders(),
      body: JSON.stringify({ p_password: plain }),
    });
    if (!res.ok) {
      console.error("hash_password RPC failed:", await res.text());
      return null;
    }
    return await res.json();
  } catch (e) {
    console.error("hash_password threw:", e);
    return null;
  }
}

async function findOrCreateClient(args: {
  email: string;
  name: string;
  phone: string;
  passwordHash: string;
}): Promise<{ id: string; name: string; isNew: boolean } | null> {
  // 1. Existing client by email (case-insensitive).
  const byEmailRes = await fetch(
    `${SUPABASE_URL}/rest/v1/clients?select=id,name&email=ilike.${encodeURIComponent(args.email)}&is_coach=eq.false&limit=1`,
    { headers: sbHeaders() }
  );
  if (byEmailRes.ok) {
    const rows = await byEmailRes.json() as Array<{ id: string; name: string }>;
    if (rows.length > 0) {
      // Reuse — overwrite password (the buyer is now setting it).
      const patchRes = await fetch(
        `${SUPABASE_URL}/rest/v1/clients?id=eq.${rows[0].id}`,
        {
          method: "PATCH",
          headers: sbHeaders(),
          body: JSON.stringify({ password_hash: args.passwordHash }),
        }
      );
      if (!patchRes.ok) {
        console.error("Patch existing client failed:", await patchRes.text());
        return null;
      }
      return { id: rows[0].id, name: rows[0].name || args.name, isNew: false };
    }
  }

  // 2. Resolve name collision (login is by name). If exact name already
  //    exists for another client, append the last 4 digits of the phone.
  let finalName = args.name;
  const nameCheckRes = await fetch(
    `${SUPABASE_URL}/rest/v1/clients?select=id&name=ilike.${encodeURIComponent(finalName)}&is_coach=eq.false&limit=1`,
    { headers: sbHeaders() }
  );
  if (nameCheckRes.ok) {
    const conflict = await nameCheckRes.json() as Array<unknown>;
    if (conflict.length > 0) {
      const suffix = args.phone.slice(-4);
      finalName = `${args.name} (${suffix})`;
    }
  }

  // 3. Create.
  const insRes = await fetch(`${SUPABASE_URL}/rest/v1/clients`, {
    method: "POST",
    headers: { ...sbHeaders(), Prefer: "return=representation" },
    body: JSON.stringify({
      name: finalName,
      email: args.email,
      password_hash: args.passwordHash,
      modules: ["nutrition_tracking", "weight_tracking", "steps_tracking"],
      is_coach: false,
      account_type: "online",
      calorie_target: 2000,
      protein_target: 140,
    }),
  });
  if (!insRes.ok) {
    console.error("Create client failed:", await insRes.text());
    return null;
  }
  const created = await insRes.json();
  const row = Array.isArray(created) ? created[0] : created;
  return { id: row.id as string, name: finalName, isNew: true };
}

async function grantModulesAndAssignCoach(clientId: string, clientName: string): Promise<string | null> {
  // Merge REMOTE_MODULES into existing modules.
  const clientRes = await fetch(
    `${SUPABASE_URL}/rest/v1/clients?select=modules,assigned_coach_id&id=eq.${clientId}`,
    { headers: sbHeaders() }
  );
  if (!clientRes.ok) return null;
  const rows = await clientRes.json() as Array<{ modules: string[]; assigned_coach_id: string | null }>;
  if (rows.length === 0) return null;
  const current = rows[0].modules || [];
  const merged = [...new Set([...current, ...REMOTE_MODULES])];

  await fetch(`${SUPABASE_URL}/rest/v1/clients?id=eq.${clientId}`, {
    method: "PATCH",
    headers: sbHeaders(),
    body: JSON.stringify({ modules: merged, account_type: "online" }),
  });

  // Coach assignment — balance by current synrg_method client counts.
  if (rows[0].assigned_coach_id) {
    const coachRes = await fetch(
      `${SUPABASE_URL}/rest/v1/clients?select=name&id=eq.${rows[0].assigned_coach_id}`,
      { headers: sbHeaders() }
    );
    if (coachRes.ok) {
      const c = await coachRes.json() as Array<{ name: string }>;
      return c[0]?.name || null;
    }
  }

  const coachesRes = await fetch(
    `${SUPABASE_URL}/rest/v1/clients?select=id,name&role=eq.coach&is_active=eq.true&order=name.asc`,
    { headers: sbHeaders() }
  );
  let candidates: Array<{ id: string; name: string }> = [];
  if (coachesRes.ok) candidates = await coachesRes.json();
  if (candidates.length === 0) {
    candidates = [
      { id: "1b0a54a2-22c0-49b6-8083-8ed6356e29d2", name: "Елина" },
      { id: "4ce4ed28-1b4c-4a57-8d22-d02a402f45ac", name: "Ицко" },
    ];
  }

  // Count current synrg_method clients per coach.
  const allSynrgRes = await fetch(
    `${SUPABASE_URL}/rest/v1/clients?select=assigned_coach_id&modules=cs.${encodeURIComponent('["synrg_method"]')}`,
    { headers: sbHeaders() }
  );
  const counts: Record<string, number> = {};
  if (allSynrgRes.ok) {
    const arr = await allSynrgRes.json() as Array<{ assigned_coach_id: string }>;
    for (const c of arr) {
      if (c.assigned_coach_id) counts[c.assigned_coach_id] = (counts[c.assigned_coach_id] || 0) + 1;
    }
  }
  const picked = candidates.reduce((min, c) =>
    (counts[c.id] || 0) < (counts[min.id] || 0) ? c : min, candidates[0]);

  await fetch(`${SUPABASE_URL}/rest/v1/clients?id=eq.${clientId}`, {
    method: "PATCH",
    headers: sbHeaders(),
    body: JSON.stringify({ assigned_coach_id: picked.id }),
  });

  // Welcome message from coach (fire-and-forget — don't fail activation).
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/coach_messages`, {
      method: "POST",
      headers: { ...sbHeaders(), Prefer: "return=minimal" },
      body: JSON.stringify({
        client_id: clientId,
        coach_id: picked.id,
        sender_role: "coach",
        sender_name: picked.name,
        text: `Здравей, ${clientName}! Аз съм ${picked.name}, твоят ментор в SYNRG Метод. Добре дошъл/дошла! Имаш 2 check-in сесии на месец — пиши ми тук когато имаш въпроси или се нуждаеш от корекция на програмата.`,
      }),
    });
  } catch (e) { console.warn("Welcome message failed:", e); }

  return picked.name;
}

async function generateInvoice(args: {
  clientId: string;
  purchaseId: string;
  buyerName: string;
  buyerEmail: string;
  buyerAddress: string;
  amountCents: number;
  currency: string;
}): Promise<number | null> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/generate-invoice`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY") || ""}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: args.clientId,
        program_purchase_id: args.purchaseId,
        buyer_name: args.buyerName,
        buyer_email: args.buyerEmail,
        buyer_address: args.buyerAddress,
        buyer_eik: null,
        buyer_vat_number: null,
        description: "SYNRG Метод — 8-седмична онлайн програма (наложен платеж)",
        amount_cents: args.amountCents,
        currency: args.currency,
        stripe_session_id: null,
        stripe_payment_intent: null,
      }),
    });
    if (!res.ok) {
      console.error("Invoice generation failed:", await res.text());
      return null;
    }
    const data = await res.json();
    return data.invoice?.invoice_number || null;
  } catch (e) {
    console.error("generateInvoice threw:", e);
    return null;
  }
}

async function sendActivationEmail(args: {
  email: string;
  loginName: string;
  coachName: string | null;
  invoiceNumber: number | null;
}): Promise<boolean> {
  const coachLine = args.coachName
    ? `<p>Менторът ти е <strong>${args.coachName}</strong> и вече ще те потърси в приложението.</p>`
    : "";
  const invoiceLine = args.invoiceNumber
    ? `<p style="font-size:13px;color:#bbb">Издадена е фактура № ${String(args.invoiceNumber).padStart(10, "0")}. Можеш да я изтеглиш от приложението.</p>`
    : "";
  const html = `
<div style="font-family:sans-serif;padding:24px;background:#1a1a1a;color:#e0e0e0;border-radius:16px;max-width:520px">
  <h2 style="color:#c4e9bf;margin:0 0 16px">Профилът ти е активен</h2>
  <p>Здравей, <strong>${args.loginName}</strong>!</p>
  <p>Програмата <strong>SYNRG Метод</strong> е активна за 8 седмици. Достъпът ти започва от днес.</p>
  <p style="background:#0d1510;padding:14px;border-radius:12px;font-size:14px;line-height:1.7">
    <strong>Влез в приложението с:</strong><br>
    Име: <strong>${args.loginName}</strong><br>
    Парола: тази, която избра при активацията
  </p>
  <p style="text-align:center;margin:24px 0">
    <a href="https://synrg-beyondfitness.com/app/" style="display:inline-block;background:#c4e9bf;color:#0d1510;padding:14px 32px;border-radius:12px;font-weight:700;text-decoration:none;font-size:16px">Отвори приложението</a>
  </p>
  ${coachLine}
  ${invoiceLine}
  <hr style="border:none;border-top:1px solid #333;margin:20px 0">
  <p style="font-size:12px;color:#666">SYNRG Beyond Fitness · Синерджи 93 ООД · ЕИК 207343690</p>
</div>`;
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/mailerlite-sync`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY") || ""}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "send_template",
        key: "cod_activation",
        email: args.email,
        name: args.loginName,
        vars: { loginName: args.loginName, coachLine, invoiceLine },
        subject: "Профилът ти е активен — SYNRG Метод",
        html,
      }),
    });
    return res.ok;
  } catch (e) {
    console.warn("Activation email failed:", e);
    return false;
  }
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const cors = corsHeaders(origin);

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: cors });

  const ip = getIp(req);
  let identifier = "";

  try {
    const body = await req.json();
    const emailRaw = (body.email || "").toString().trim();
    const password = (body.password || "").toString();
    const phoneRaw = (body.phone || "").toString().trim();
    const turnstileToken = body.turnstile_token || null;

    identifier = emailRaw || phoneRaw;

    if (!password || password.length < 6) {
      return new Response(
        JSON.stringify({ error: "weak_password", message: "Паролата трябва да е поне 6 символа." }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }
    const email = emailRaw.toLowerCase();
    if (!email || !isValidEmail(email)) {
      return new Response(
        JSON.stringify({ error: "invalid_email", message: "Невалиден имейл адрес." }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }
    const phone = phoneRaw ? normalizeBgPhone(phoneRaw) : null;

    if (await isRateLimited(ip)) {
      await logAttempt(ip, identifier, false);
      return new Response(
        JSON.stringify({ error: "rate_limited", message: "Прекалено много опити. Опитай след час." }),
        { status: 429, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    await verifyTurnstile(turnstileToken, ip);

    // ── Find pending order ────────────────────────────────────
    const order = await findPendingOrder(email, phone);
    if (!order) {
      await logAttempt(ip, identifier, false);
      return new Response(
        JSON.stringify({
          error: "no_pending_order",
          message: "Не намираме поръчка с този имейл. Провери дали имейлът е същият, който написа при поръчката. Ако си сгрешил — напиши телефонния номер по-долу.",
        }),
        { status: 404, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // ── Materialise client ────────────────────────────────────
    const passwordHash = await hashPassword(password);
    if (!passwordHash) {
      return new Response(
        JSON.stringify({ error: "hash_failed", message: "Сървърна грешка. Опитай отново." }),
        { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const client = await findOrCreateClient({
      email,
      name: order.shipping_name,
      phone: order.shipping_phone,
      passwordHash,
    });
    if (!client) {
      return new Response(
        JSON.stringify({ error: "client_create_failed", message: "Не успяхме да създадем профила. Опитай отново." }),
        { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // ── Link order + flip status ──────────────────────────────
    const nowIso = new Date().toISOString();
    const validUntil = new Date(Date.now() + PROGRAM_DURATION_WEEKS * 7 * 24 * 60 * 60 * 1000)
      .toISOString().slice(0, 10);
    await fetch(`${SUPABASE_URL}/rest/v1/program_purchases?id=eq.${order.id}`, {
      method: "PATCH",
      headers: sbHeaders(),
      body: JSON.stringify({
        client_id: client.id,
        status: "active",
        fulfillment_status: "delivered",
        delivered_at: nowIso,
        valid_until: validUntil,
      }),
    });

    // ── Grant modules + assign coach ──────────────────────────
    const coachName = await grantModulesAndAssignCoach(client.id, client.name);

    // ── Invoice ───────────────────────────────────────────────
    const invoiceNumber = await generateInvoice({
      clientId: client.id,
      purchaseId: order.id,
      buyerName: order.shipping_name,
      buyerEmail: email,
      buyerAddress: order.shipping_address,
      amountCents: order.amount_cents,
      currency: order.currency,
    });

    // ── Activation email (fire-and-forget) ────────────────────
    sendActivationEmail({
      email,
      loginName: client.name,
      coachName,
      invoiceNumber,
    }).catch((e) => console.warn("Activation email error:", e));

    // ── Reset client_program_state if any (renewal case) ──────
    try {
      const stateRes = await fetch(
        `${SUPABASE_URL}/rest/v1/client_program_state?select=client_id&client_id=eq.${client.id}`,
        { headers: sbHeaders() }
      );
      if (stateRes.ok) {
        const rows = await stateRes.json() as Array<unknown>;
        if (rows.length > 0) {
          await fetch(`${SUPABASE_URL}/rest/v1/client_program_state?client_id=eq.${client.id}`, {
            method: "PATCH",
            headers: sbHeaders(),
            body: JSON.stringify({
              started_at: nowIso,
              current_week: 1,
              paused: false,
              completed_at: null,
              updated_at: nowIso,
            }),
          });
        }
      }
    } catch (e) { console.warn("program state reset failed:", e); }

    await logAttempt(ip, identifier, true);
    return new Response(
      JSON.stringify({
        ok: true,
        login_name: client.name,
        coach_name: coachName,
        is_new_client: client.isNew,
      }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("activate-cod-order error:", err);
    if (identifier) await logAttempt(ip, identifier, false);
    return new Response(
      JSON.stringify({ error: "server_error", message: "Сървърна грешка. Опитай отново." }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});
