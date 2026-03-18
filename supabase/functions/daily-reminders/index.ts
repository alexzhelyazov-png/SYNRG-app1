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

    const results = { expiry_reminders: 0, training_reminders: 0 };

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
