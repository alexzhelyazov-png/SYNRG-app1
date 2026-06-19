/**
 * Supabase Edge Function: create-cod-order
 *
 * Accepts an order form submission with shipping info + chosen email.
 * Inserts a row in program_purchases with status='pending_delivery',
 * payment_method='cod', client_id=NULL. No clients row is created here —
 * that happens at activation time (/start → activate-cod-order) once the
 * buyer has the physical postcard in hand.
 *
 * Safeguards:
 *   - Cloudflare Turnstile soft-mode (same as auth-register)
 *   - Rate limit: 3 orders / IP / hour via auth_attempts table
 *   - BG phone format validation
 *   - Email format validation
 *   - Duplicate email guard: reject if there is already an active CoD
 *     order pending for the same email (prevents fat-finger re-submits).
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TURNSTILE_SECRET = Deno.env.get("TURNSTILE_SECRET_KEY") || "";

// SYNRG Метод is the only product sold via CoD right now.
// UUID of the "SYNRG Метод" row in public.programs (price_cents=9800 EUR).
const COD_PROGRAM_ID = "b83982f2-7d7c-4ede-b721-4d0e3642c8ed";
const COD_AMOUNT_CENTS = 9800; // €98.00 — matches Stripe price
const COD_CURRENCY = "EUR";

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

function getIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

function normalizeBgPhone(raw: string): string | null {
  // Accept: 0888123456, +359888123456, 359888123456, with or without spaces/dashes.
  // Return canonical +359XXXXXXXXX (12 chars after +) or null if invalid.
  const digits = raw.replace(/[\s\-()]/g, "");
  let body = digits;
  if (body.startsWith("+359")) body = body.slice(4);
  else if (body.startsWith("00359")) body = body.slice(5);
  else if (body.startsWith("359")) body = body.slice(3);
  else if (body.startsWith("0")) body = body.slice(1);
  // BG mobile numbers are 9 digits after country code, start with 8 or 9.
  if (!/^[89]\d{8}$/.test(body)) return null;
  return "+359" + body;
}

function isValidEmail(raw: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw);
}

async function verifyTurnstile(token: string | null, ip: string): Promise<boolean> {
  if (!TURNSTILE_SECRET) return true;
  if (!token) {
    console.warn("[turnstile] no token supplied — allowing in soft mode");
    return true;
  }
  try {
    const formData = new FormData();
    formData.append("secret", TURNSTILE_SECRET);
    formData.append("response", token);
    formData.append("remoteip", ip);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    if (!data.success) console.warn("[turnstile] failed verify:", data["error-codes"]);
    return true;
  } catch (e) {
    console.warn("[turnstile] verify exception (allowing through):", e);
    return true;
  }
}

async function isRateLimited(ip: string): Promise<{ blocked: boolean; reason?: string }> {
  try {
    const cutoff1h = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/auth_attempts?select=created_at&ip=eq.${encodeURIComponent(ip)}&action=eq.create_cod_order&created_at=gte.${cutoff1h}&limit=10`,
      { headers: sbHeaders() }
    );
    if (res.ok) {
      const recent = await res.json() as Array<unknown>;
      if (recent.length >= 3) {
        return { blocked: true, reason: "Прекалено много поръчки от това устройство. Опитай след час." };
      }
    }
  } catch (e) {
    console.warn("Rate limit check failed:", e);
  }
  return { blocked: false };
}

async function logAttempt(ip: string, name: string, success: boolean) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/auth_attempts`, {
      method: "POST",
      headers: { ...sbHeaders(), Prefer: "return=minimal" },
      body: JSON.stringify({ ip, name, action: "create_cod_order", success }),
    });
  } catch (e) {
    console.warn("Failed to log attempt:", e);
  }
}

async function sendOrderConfirmationEmail(email: string, name: string): Promise<boolean> {
  const html = `
<div style="font-family:sans-serif;padding:24px;background:#1a1a1a;color:#e0e0e0;border-radius:16px;max-width:520px">
  <h2 style="color:#c4e9bf;margin:0 0 16px">Поръчката ти е приета</h2>
  <p>Здравей, <strong>${name}</strong>!</p>
  <p>Получихме поръчката ти за <strong>SYNRG Метод</strong> (8-седмична онлайн програма) с наложен платеж.</p>
  <p style="background:#0d1510;padding:14px;border-radius:12px;font-size:14px;line-height:1.7">
    <strong>Цена:</strong> €98 (плащаш на куриера при получаване)<br>
    <strong>Куриер:</strong> Еконт<br>
    <strong>Очаквай пратката:</strong> 2-3 работни дни
  </p>
  <p>В плика ще намериш картичка с QR код. Сканирай го за да активираш профила си и да започнеш веднага.</p>
  <p style="font-size:13px;color:#bbb;margin-top:20px">
    <strong>Важно:</strong> провери дали в имейла, който си написа при поръчката, няма грешка
    (<a href="mailto:${email}" style="color:#c4e9bf">${email}</a>). С него ще активираш профила си.
    Ако виждаш грешка — пиши ни на Viber: 0888 XXX XXX или отговори на този имейл.
  </p>
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
        action: "send_email",
        email,
        name,
        fields: {},
        subject: "Поръчката ти е приета — SYNRG Метод",
        html,
      }),
    });
    return res.ok;
  } catch (e) {
    console.warn("Order confirmation email failed:", e);
    return false;
  }
}

async function sendAdminNewOrderAlert(args: {
  name: string;
  email: string;
  phone: string;
  address: string;
  orderId: string;
}) {
  const html = `
<div style="font-family:sans-serif;padding:24px;background:#0d1510;color:#e0e0e0;border-radius:16px;max-width:520px">
  <h2 style="color:#c4e9bf;margin:0 0 16px;font-size:22px">📦 Нова CoD поръчка</h2>
  <table style="width:100%;border-collapse:collapse;font-size:14px;line-height:1.7">
    <tr><td style="color:#888;width:120px">Име</td><td><strong>${args.name}</strong></td></tr>
    <tr><td style="color:#888">Телефон</td><td>${args.phone}</td></tr>
    <tr><td style="color:#888">Имейл</td><td>${args.email}</td></tr>
    <tr><td style="color:#888;vertical-align:top">Адрес</td><td>${args.address.replace(/\n/g, "<br>")}</td></tr>
    <tr><td style="color:#888">Цена</td><td>€98 (наложен платеж)</td></tr>
    <tr><td style="color:#888">ID</td><td style="font-family:monospace;font-size:12px">${args.orderId}</td></tr>
  </table>
  <p style="margin-top:20px;color:#bbb;font-size:13px">
    Подготви пратка с картичка и я предай на куриер. След като клиентът сканира QR — профилът се активира автоматично.
  </p>
</div>`;
  const recipients = ["info@synrg-beyondfitness.com", "aleksandarzhelyazov@gmail.com"];
  for (const to of recipients) {
    try {
      await fetch(`${SUPABASE_URL}/functions/v1/mailerlite-sync`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY") || ""}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "send_email",
          email: to,
          name: "SYNRG",
          fields: {},
          subject: `📦 Нова CoD поръчка · ${args.name}`,
          html,
        }),
      });
    } catch (e) {
      console.warn(`Admin alert to ${to} failed:`, e);
    }
  }
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

  const ip = getIp(req);
  let nameField = "";

  try {
    const body = await req.json();
    const name = (body.name || "").toString().trim();
    const phoneRaw = (body.phone || "").toString().trim();
    const address = (body.address || "").toString().trim();
    const emailRaw = (body.email || "").toString().trim();
    const turnstileToken = body.turnstile_token || null;
    nameField = name;

    // ── Field validation ──────────────────────────────────────
    if (!name || name.length < 3) {
      return new Response(
        JSON.stringify({ error: "invalid_name", message: "Моля въведи име и фамилия." }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }
    if (!address || address.length < 10) {
      return new Response(
        JSON.stringify({ error: "invalid_address", message: "Моля въведи пълен адрес за доставка." }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }
    const phone = normalizeBgPhone(phoneRaw);
    if (!phone) {
      return new Response(
        JSON.stringify({ error: "invalid_phone", message: "Невалиден български телефонен номер. Пример: 0888 123 456." }),
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

    // ── Rate limit ────────────────────────────────────────────
    const rate = await isRateLimited(ip);
    if (rate.blocked) {
      await logAttempt(ip, name, false);
      return new Response(
        JSON.stringify({ error: "rate_limited", message: rate.reason }),
        { status: 429, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // ── Bot check ─────────────────────────────────────────────
    await verifyTurnstile(turnstileToken, ip);

    // ── Duplicate pending order guard ─────────────────────────
    // If this email already has an unactivated CoD order, return the
    // existing one's info instead of creating a duplicate. Prevents
    // double-submission from confusing the buyer.
    const existingRes = await fetch(
      `${SUPABASE_URL}/rest/v1/program_purchases?select=id,created_at&payment_method=eq.cod&status=eq.pending_delivery&activation_email=eq.${encodeURIComponent(email)}&limit=1`,
      { headers: sbHeaders() }
    );
    if (existingRes.ok) {
      const existing = await existingRes.json() as Array<{ id: string; created_at: string }>;
      if (existing.length > 0) {
        await logAttempt(ip, name, true);
        return new Response(
          JSON.stringify({
            ok: true,
            duplicate: true,
            message: "Вече имаме поръчка с този имейл. Очаквай куриера.",
            order_id: existing[0].id,
          }),
          { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
        );
      }
    }

    // ── Insert pending order ──────────────────────────────────
    const insRes = await fetch(`${SUPABASE_URL}/rest/v1/program_purchases`, {
      method: "POST",
      headers: { ...sbHeaders(), Prefer: "return=representation" },
      body: JSON.stringify({
        client_id: null,
        program_id: COD_PROGRAM_ID,
        amount_cents: COD_AMOUNT_CENTS,
        currency: COD_CURRENCY,
        status: "pending_delivery",
        payment_method: "cod",
        fulfillment_status: "pending",
        shipping_name: name,
        shipping_phone: phone,
        shipping_address: address,
        activation_email: email,
      }),
    });
    if (!insRes.ok) {
      const errText = await insRes.text();
      console.error("Insert program_purchases failed:", errText);
      await logAttempt(ip, name, false);
      return new Response(
        JSON.stringify({ error: "db_insert_failed", message: "Не успяхме да запишем поръчката. Опитай отново." }),
        { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }
    const inserted = await insRes.json();
    const order = Array.isArray(inserted) ? inserted[0] : inserted;

    // ── Side effects (fire-and-forget; failures only logged) ──
    sendOrderConfirmationEmail(email, name).catch((e) => console.warn("confirmation email error:", e));
    sendAdminNewOrderAlert({
      name,
      email,
      phone,
      address,
      orderId: order.id as string,
    }).catch((e) => console.warn("admin alert error:", e));

    await logAttempt(ip, name, true);
    return new Response(
      JSON.stringify({ ok: true, order_id: order.id }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("create-cod-order error:", err);
    if (nameField) await logAttempt(ip, nameField, false);
    return new Response(
      JSON.stringify({ error: "server_error", message: "Сървърна грешка. Опитай отново." }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});
