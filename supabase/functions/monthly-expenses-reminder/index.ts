/**
 * Supabase Edge Function: Monthly Expenses Reminder
 *
 * На 30-то число всеки месец праща имейл на Кари да попълни месечните
 * разходи (Админ → Финанси → Разходи) преди месецът да приключи и
 * клетките да се заключат автоматично.
 *
 * (SMS беше обмислено, но Brevo акаунтът няма активиран SMS addon — само
 * имейл засега. Ако SMS кредити се купят по-късно, вижте git история за
 * как да се върне транзакционният SMS call.)
 *
 * Deploy:
 *   npx supabase functions deploy monthly-expenses-reminder --no-verify-jwt --project-ref nzrtdqlgljcipfmectwp
 *
 * Call:
 *   POST .../functions/v1/monthly-expenses-reminder
 *   Authorization: Bearer <EXPENSES_REMINDER_TOKEN>
 *   {}                  → изпраща за текущия месец
 *   { "dry_run": true } → връща съдържанието без да изпраща
 *
 * Cron (ad-hoc, run once in the Supabase SQL editor — this repo doesn't
 * track pg_cron jobs as migrations, see studio-monthly-report for the
 * same convention):
 *   SELECT cron.schedule('monthly-expenses-reminder', '0 9 30 * *',
 *     $$SELECT net.http_post(
 *       'https://nzrtdqlgljcipfmectwp.supabase.co/functions/v1/monthly-expenses-reminder',
 *       '{}'::jsonb, '{"Authorization":"Bearer <EXPENSES_REMINDER_TOKEN>","Content-Type":"application/json"}'::jsonb
 *     )$$
 *   );
 *   Забележка: "30 * *" не гръмва през февруари (и понякога други къси
 *   месеци) — приемливо, щом месецът няма 30-то число, няма и какво да се
 *   заключва още на тази дата.
 */

const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY")!;
// Dedicated token (not the shared REPORT_EMAIL_TOKEN) — this function has no
// recipient other than Кари, so a scoped secret keeps it independently
// rotatable without touching the half-dozen other report functions.
const AUTH_TOKEN = Deno.env.get("EXPENSES_REMINDER_TOKEN")!;

const COO_EMAIL = Deno.env.get("COO_EMAIL") || "karina_sokolova@abv.bg";
const COO_NAME = "Кари";

const SENDER_EMAIL = { name: "SYNRG Отчети", email: "info@synrg-beyondfitness.com" };

const BG_MONTHS = ["януари", "февруари", "март", "април", "май", "юни",
  "юли", "август", "септември", "октомври", "ноември", "декември"];

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "POST only" }), { status: 405 });
  }
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!AUTH_TOKEN || token !== AUTH_TOKEN) {
    return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), { status: 401 });
  }

  let body: { dry_run?: boolean };
  try { body = await req.json(); } catch { body = {}; }

  const now = new Date();
  const label = `${BG_MONTHS[now.getUTCMonth()]} ${now.getUTCFullYear()}`;

  const html = `<div style="background:#111311;padding:26px 16px;font-family:Arial,sans-serif">
<div style="max-width:480px;margin:0 auto">
<div style="font:700 18px/1.3 Arial,sans-serif;color:#e8ece8">Здравей ${COO_NAME},</div>
<div style="font:400 14px/1.6 Arial,sans-serif;color:#c7cdc7;padding:12px 0">
Месецът ${label} приключва — не забравяй да попълниш разходите (заплати, наем, ток и вода, счетоводство, осигуровки, амортизация, реклама, оборудване, други) в <strong style="color:#c4e9bf">Админ → Финанси → Разходи</strong>, докато месецът все още е отворен за редакция.
</div>
<div style="font:400 11px/1.5 Arial,sans-serif;color:#8a938a;padding-top:18px;border-top:1px solid #2a2e2a;margin-top:18px">
Автоматично напомняне · monthly-expenses-reminder
</div></div></div>`;

  if (body.dry_run) {
    return new Response(JSON.stringify({ ok: true, dry_run: true, label, to: COO_EMAIL }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const emailRes = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      sender: SENDER_EMAIL,
      to: [{ email: COO_EMAIL, name: COO_NAME }],
      subject: `Попълни разходите за ${label}`,
      htmlContent: html,
    }),
  });

  if (!emailRes.ok) {
    return new Response(JSON.stringify({ ok: false, error: "brevo failed", detail: await emailRes.text() }), { status: 502 });
  }

  return new Response(JSON.stringify({ ok: true, label, to: COO_EMAIL }), {
    headers: { "Content-Type": "application/json" },
  });
});
