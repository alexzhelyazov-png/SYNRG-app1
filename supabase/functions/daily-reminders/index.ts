/**
 * Supabase Edge Function: Daily Reminders
 *
 * Run daily via cron (or manual invoke) to send:
 * 1. Plan expiry reminders (3 days before)
 * 2. Tomorrow's training reminders
 *
 * Setup: In Supabase Dashboard → SQL Editor, create a cron job:
 *   SELECT cron.schedule('daily-reminders', '0 9 * * *',
 *     $$SELECT net.http_post(
 *       'https://nzrtdqlgljcipfmectwp.supabase.co/functions/v1/daily-reminders',
 *       '{}', '{"Authorization":"Bearer <service_role_key>"}', 'application/json'
 *     )$$
 *   );
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BREVO_API = "https://api.brevo.com/v3";
const SENDER = { name: "SYNRG Beyond Fitness", email: "info@synrg-beyondfitness.com" };

async function sendEmail(brevoKey: string, to: { email: string; name?: string }, subject: string, html: string) {
  await fetch(`${BREVO_API}/smtp/email`, {
    method: "POST",
    headers: { "api-key": brevoKey, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ sender: SENDER, to: [to], subject, htmlContent: html }),
  });
}

function isoDate(offset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const brevoKey = Deno.env.get("BREVO_API_KEY")!;

    const sbHeaders = {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    };

    const results = {
      expiry_reminders: 0,
      training_reminders: 0,
      program_warned_7d: 0,
      program_warned_1d: 0,
      program_expired: 0,
    };
    const FREE_MODULES = ["nutrition_tracking", "weight_tracking", "steps_tracking"];

    // ── 1. Plan expiry reminders (expiring in 3 days) ──────────
    const in3days = isoDate(3);
    const plansRes = await fetch(
      `${supabaseUrl}/rest/v1/client_plans?select=client_id,plan_type,valid_to,extended_to&status=eq.active`,
      { headers: sbHeaders }
    );
    const plans = await plansRes.json();

    for (const plan of plans || []) {
      const expiryDate = plan.extended_to || plan.valid_to;
      if (expiryDate !== in3days) continue;

      // Get client email
      const clientRes = await fetch(
        `${supabaseUrl}/rest/v1/clients?select=name,email&id=eq.${plan.client_id}&limit=1`,
        { headers: sbHeaders }
      );
      const clients = await clientRes.json();
      if (!clients?.[0]?.email) continue;

      const client = clients[0];
      const fmtDate = new Date(expiryDate + "T00:00:00").toLocaleDateString("bg-BG", {
        day: "numeric", month: "long", year: "numeric",
      });

      await sendEmail(brevoKey, { email: client.email, name: client.name },
        "Планът ти изтича скоро!",
        `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#1a1a1a;color:#e0e0e0;border-radius:16px">
          <h2 style="color:#FB923C;margin:0 0 16px">${client.name},</h2>
          <p style="font-size:16px;line-height:1.6">Планът ти в SYNRG Beyond Fitness изтича на <strong style="color:#FB923C">${fmtDate}</strong>.</p>
          <p style="font-size:14px;color:#999;line-height:1.6">Свържи се с нас за подновяване, за да не прекъсваш тренировките!</p>
          <hr style="border:none;border-top:1px solid #333;margin:24px 0">
          <p style="font-size:12px;color:#666">SYNRG Beyond Fitness</p>
        </div>`
      );
      results.expiry_reminders++;
    }

    // ── 2. Tomorrow's training reminders ───────────────────────
    const tomorrow = isoDate(1);
    const slotsRes = await fetch(
      `${supabaseUrl}/rest/v1/booking_slots?select=id,slot_date,start_time&slot_date=eq.${tomorrow}&status=eq.active`,
      { headers: sbHeaders }
    );
    const tomorrowSlots = await slotsRes.json();

    for (const slot of tomorrowSlots || []) {
      // Get bookings for this slot
      const bookingsRes = await fetch(
        `${supabaseUrl}/rest/v1/slot_bookings?select=client_id,client_name&slot_id=eq.${slot.id}&status=eq.active`,
        { headers: sbHeaders }
      );
      const bookings = await bookingsRes.json();

      for (const booking of bookings || []) {
        // Get client email
        const clientRes = await fetch(
          `${supabaseUrl}/rest/v1/clients?select=name,email&id=eq.${booking.client_id}&limit=1`,
          { headers: sbHeaders }
        );
        const clients = await clientRes.json();
        if (!clients?.[0]?.email) continue;

        const client = clients[0];
        const timeStr = slot.start_time?.slice(0, 5) || "";

        await sendEmail(brevoKey, { email: client.email, name: client.name },
          "Утре имаш тренировка!",
          `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#1a1a1a;color:#e0e0e0;border-radius:16px">
            <h2 style="color:#c4e9bf;margin:0 0 16px">${client.name},</h2>
            <p style="font-size:16px;line-height:1.6">Напомняне: утре имаш тренировка!</p>
            <div style="background:#252525;border-radius:12px;padding:16px;margin:16px 0">
              <p style="margin:0;font-size:18px;font-weight:bold;color:#c4e9bf">${timeStr}</p>
              <p style="margin:4px 0 0;font-size:13px;color:#999">SYNRG Beyond Fitness Studio</p>
            </div>
            <p style="font-size:13px;color:#666">Ако не можеш да присъстваш, моля отмени от приложението.</p>
            <hr style="border:none;border-top:1px solid #333;margin:24px 0">
            <p style="font-size:12px;color:#666">SYNRG Beyond Fitness</p>
          </div>`
        );
        results.training_reminders++;
      }
    }

    // ── 3. Program purchase expiry — 7 day warning ────────────
    const in7days = isoDate(7);
    const warn7Res = await fetch(
      `${supabaseUrl}/rest/v1/program_purchases?select=id,client_id,valid_until&status=eq.active&valid_until=eq.${in7days}&expiry_warned_7d=eq.false`,
      { headers: sbHeaders }
    );
    const warn7 = await warn7Res.json();
    for (const purch of warn7 || []) {
      const cRes = await fetch(`${supabaseUrl}/rest/v1/clients?select=name,email&id=eq.${purch.client_id}&limit=1`, { headers: sbHeaders });
      const client = (await cRes.json())?.[0];
      if (client?.email) {
        await sendEmail(brevoKey, { email: client.email, name: client.name },
          "Програмата ти приключва след 7 дни",
          `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#1a1a1a;color:#e0e0e0;border-radius:16px">
            <h2 style="color:#c4e9bf;margin:0 0 16px">${client.name || "клиент"},</h2>
            <p style="font-size:16px;line-height:1.6">Остават 7 дни до края на твоята 8-седмична програма SYNRG Метод!</p>
            <p style="font-size:14px;color:#bbb;line-height:1.6">Това е момента да:</p>
            <ul style="font-size:14px;color:#bbb;line-height:1.7">
              <li>Премериш напредъка си (тегло, снимки)</li>
              <li>Запишеш final check-in с твоя ментор</li>
              <li>Завършиш всички уроци които си пропуснал</li>
            </ul>
            <p style="font-size:13px;color:#999">След 7 дни преминаваш на freemium режим — задържаш достъп до hranene/тегло/стъпки трекерите, но не и до програмата и тренера.</p>
            <hr style="border:none;border-top:1px solid #333;margin:24px 0">
            <p style="font-size:12px;color:#666">SYNRG Beyond Fitness</p>
          </div>`
        );
      }
      await fetch(`${supabaseUrl}/rest/v1/program_purchases?id=eq.${purch.id}`, {
        method: "PATCH",
        headers: { ...sbHeaders, Prefer: "return=minimal" },
        body: JSON.stringify({ expiry_warned_7d: true }),
      });
      results.program_warned_7d++;
    }

    // ── 4. Program purchase expiry — 1 day warning ────────────
    const in1day = isoDate(1);
    const warn1Res = await fetch(
      `${supabaseUrl}/rest/v1/program_purchases?select=id,client_id,valid_until&status=eq.active&valid_until=eq.${in1day}&expiry_warned_1d=eq.false`,
      { headers: sbHeaders }
    );
    const warn1 = await warn1Res.json();
    for (const purch of warn1 || []) {
      const cRes = await fetch(`${supabaseUrl}/rest/v1/clients?select=name,email&id=eq.${purch.client_id}&limit=1`, { headers: sbHeaders });
      const client = (await cRes.json())?.[0];
      if (client?.email) {
        await sendEmail(brevoKey, { email: client.email, name: client.name },
          "Утре приключва програмата ти",
          `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#1a1a1a;color:#e0e0e0;border-radius:16px">
            <h2 style="color:#FB923C;margin:0 0 16px">${client.name || "клиент"},</h2>
            <p style="font-size:16px;line-height:1.6">Утре е последният ти ден от 8-седмичната програма SYNRG Метод!</p>
            <p style="font-size:14px;color:#bbb;line-height:1.6">Това е завършен цикъл — поздравления! От утре:</p>
            <ul style="font-size:14px;color:#bbb;line-height:1.7">
              <li>Запазваш достъп до hranene, тегло и стъпки трекерите</li>
              <li>Свалят се: програмата, тренера, тренировъчните планове</li>
            </ul>
            <p style="font-size:14px;color:#c4e9bf">Искаш ли да започнем нова програма заедно? Свържи се с нас!</p>
            <hr style="border:none;border-top:1px solid #333;margin:24px 0">
            <p style="font-size:12px;color:#666">SYNRG Beyond Fitness</p>
          </div>`
        );
      }
      await fetch(`${supabaseUrl}/rest/v1/program_purchases?id=eq.${purch.id}`, {
        method: "PATCH",
        headers: { ...sbHeaders, Prefer: "return=minimal" },
        body: JSON.stringify({ expiry_warned_1d: true }),
      });
      results.program_warned_1d++;
    }

    // ── 5. Program purchase expiry — auto-revoke modules ───────
    // Find purchases past valid_until that are still active
    const today = isoDate(0);
    const expiredRes = await fetch(
      `${supabaseUrl}/rest/v1/program_purchases?select=id,client_id,valid_until&status=eq.active&valid_until=lt.${today}`,
      { headers: sbHeaders }
    );
    const expired = await expiredRes.json();
    for (const purch of expired || []) {
      // Mark as expired
      await fetch(`${supabaseUrl}/rest/v1/program_purchases?id=eq.${purch.id}`, {
        method: "PATCH",
        headers: { ...sbHeaders, Prefer: "return=minimal" },
        body: JSON.stringify({ status: "expired", expired_at: new Date().toISOString() }),
      });

      // Revoke modules → FREE_MODULES (only if no OTHER active program purchase)
      const otherActive = await fetch(
        `${supabaseUrl}/rest/v1/program_purchases?select=id&client_id=eq.${purch.client_id}&status=eq.active&id=neq.${purch.id}&limit=1`,
        { headers: sbHeaders }
      );
      const others = await otherActive.json();
      if (!others || others.length === 0) {
        // Also check for active studio plan — don't revoke if studio client
        const studioPlanRes = await fetch(
          `${supabaseUrl}/rest/v1/client_plans?select=id&client_id=eq.${purch.client_id}&status=eq.active&limit=1`,
          { headers: sbHeaders }
        );
        const studioPlan = await studioPlanRes.json();
        if (!studioPlan || studioPlan.length === 0) {
          await fetch(`${supabaseUrl}/rest/v1/clients?id=eq.${purch.client_id}`, {
            method: "PATCH",
            headers: { ...sbHeaders, Prefer: "return=minimal" },
            body: JSON.stringify({ modules: FREE_MODULES, account_type: "free" }),
          });
        }
      }

      // Send "program completed" email
      const cRes = await fetch(`${supabaseUrl}/rest/v1/clients?select=name,email&id=eq.${purch.client_id}&limit=1`, { headers: sbHeaders });
      const client = (await cRes.json())?.[0];
      if (client?.email) {
        await sendEmail(brevoKey, { email: client.email, name: client.name },
          "Завърши SYNRG Метод — поздравления!",
          `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#1a1a1a;color:#e0e0e0;border-radius:16px">
            <h2 style="color:#c4e9bf;margin:0 0 16px">${client.name || "клиент"},</h2>
            <p style="font-size:16px;line-height:1.6">Завърши успешно 8-седмичната програма SYNRG Метод. Поздравления!</p>
            <p style="font-size:14px;color:#bbb;line-height:1.6">Какво следва?</p>
            <ul style="font-size:14px;color:#bbb;line-height:1.7">
              <li>Запазваш достъп до freemium трекери (hranene, тегло, стъпки)</li>
              <li>Можеш да продължиш да си записваш тренировки и да следиш прогрес</li>
              <li>Готов ли си за следващото ниво? Запиши се за студио тренировки или нова онлайн програма</li>
            </ul>
            <p style="font-size:14px;color:#c4e9bf">Благодарим ти за доверието. Очакваме те за следващата стъпка!</p>
            <hr style="border:none;border-top:1px solid #333;margin:24px 0">
            <p style="font-size:12px;color:#666">SYNRG Beyond Fitness · Синерджи 93 ООД</p>
          </div>`
        );
      }
      results.program_expired++;
    }

    return new Response(JSON.stringify({ success: true, ...results }), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Daily reminders error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
