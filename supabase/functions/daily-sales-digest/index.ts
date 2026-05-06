/**
 * Supabase Edge Function: Daily Sales Digest
 *
 * Run every morning via cron (07:00 UTC = 10:00 BG time). Sends a single
 * email summary of the previous 24 hours of online program activity:
 *
 *   • New purchases (count + revenue)
 *   • Refunds processed
 *   • Active total clients + program week distribution
 *   • Heads-up flags: clients without coach, disputes pending, expiring this week
 *
 * Goes to info@synrg-beyondfitness.com so the team has a single touchpoint.
 *
 * Setup (run once in Supabase SQL editor):
 *   SELECT cron.schedule('daily-sales-digest', '0 7 * * *',
 *     $$SELECT net.http_post(
 *       'https://nzrtdqlgljcipfmectwp.supabase.co/functions/v1/daily-sales-digest',
 *       '{}'::jsonb,
 *       '{"Content-Type":"application/json"}'::jsonb
 *     )$$);
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY")!;

const DIGEST_RECIPIENTS = ["info@synrg-beyondfitness.com", "aleksandarzhelyazov@gmail.com"];
const SENDER = { name: "SYNRG Beyond Fitness", email: "info@synrg-beyondfitness.com" };
const PROGRAM_WEEKS = 8;

function sbHeaders() {
  return {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    "Content-Type": "application/json",
  };
}

async function sbQuery<T = unknown>(table: string, params: string): Promise<T[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${params}`, { headers: sbHeaders() });
  if (!res.ok) {
    console.warn(`sbQuery ${table} failed:`, res.status, await res.text());
    return [];
  }
  return res.json();
}

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      sender: SENDER,
      to: [{ email: to }],
      subject,
      htmlContent: html,
      headers: { "X-Mailer": "SYNRG Daily Digest" },
    }),
  });
  if (!res.ok) console.warn(`Email to ${to} failed:`, res.status, await res.text());
}

interface Purchase {
  id: string;
  client_id: string;
  amount_cents: number;
  currency: string;
  status: string;
  purchased_at: string;
  refunded_at: string | null;
  valid_until: string | null;
}
interface Client { id: string; name: string; email: string; assigned_coach_id: string | null }

function fmt(amount: number, currency: string) {
  return `${amount.toFixed(0)} ${currency.toUpperCase()}`;
}

function row(label: string, value: string, color = "#e0e0e0") {
  return `<tr><td style="color:#888;padding:4px 12px 4px 0;font-size:13px">${label}</td><td style="color:${color};font-weight:600;padding:4px 0;font-size:14px">${value}</td></tr>`;
}

Deno.serve(async (_req: Request) => {
  try {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 3600 * 1000);
    const yesterdayIso = yesterday.toISOString();
    const todayIso = now.toISOString();

    // Pull all program_purchases — small enough to filter in memory at this stage.
    const allPurchases = await sbQuery<Purchase>(
      "program_purchases",
      "?select=id,client_id,amount_cents,currency,status,purchased_at,refunded_at,valid_until&order=purchased_at.desc&limit=2000"
    );
    const realPurchases = allPurchases.filter(p =>
      Number(p.amount_cents || 0) > 0 // skip €0 manual test rows
    );

    const newSales   = realPurchases.filter(p => p.purchased_at && p.purchased_at >= yesterdayIso && p.purchased_at < todayIso && p.status !== "refunded" && p.status !== "disputed");
    const newRefunds = realPurchases.filter(p => p.refunded_at && p.refunded_at >= yesterdayIso && p.refunded_at < todayIso);
    const activeNow  = realPurchases.filter(p => p.status === "active");
    const disputed   = realPurchases.filter(p => p.status === "disputed");

    // Revenue
    const newSalesRevenue = newSales.reduce((s, p) => s + Number(p.amount_cents || 0) / 100, 0);
    const refundedSum     = newRefunds.reduce((s, p) => s + Number(p.amount_cents || 0) / 100, 0);
    const activeRevenue   = activeNow.reduce((s, p) => s + Number(p.amount_cents || 0) / 100, 0);

    // Clients lookup for new sales (so we can list names in the digest)
    const newClientIds = [...new Set(newSales.map(p => p.client_id).filter(Boolean))];
    const clients: Client[] = newClientIds.length
      ? await sbQuery<Client>("clients", `?select=id,name,email,assigned_coach_id&id=in.(${newClientIds.join(",")})`)
      : [];
    const clientById = new Map(clients.map(c => [c.id, c]));

    // Coach names (look them up once)
    const coachIds = [...new Set(clients.map(c => c.assigned_coach_id).filter(Boolean) as string[])];
    const coaches: Client[] = coachIds.length
      ? await sbQuery<Client>("clients", `?select=id,name&id=in.(${coachIds.join(",")})`)
      : [];
    const coachById = new Map(coaches.map(c => [c.id, c]));

    // Active clients without an assigned coach (heads-up)
    const activeWithoutCoach = (await sbQuery<Client>(
      "clients",
      `?select=id,name,email,assigned_coach_id&account_type=eq.online&assigned_coach_id=is.null&limit=20`
    )) || [];

    // Expiring this week (valid_until in next 7 days)
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const today = now.toISOString().slice(0, 10);
    const expiringSoon = activeNow.filter(p => p.valid_until && p.valid_until >= today && p.valid_until <= weekFromNow);

    // Compose HTML
    const dateLabel = yesterday.toLocaleDateString("bg-BG", { day: "2-digit", month: "long", year: "numeric" });
    const newSalesHtml = newSales.length === 0
      ? `<p style="color:#888;font-size:13px;font-style:italic">Няма нови покупки.</p>`
      : `<table style="width:100%;border-collapse:collapse;margin-top:8px">${
          newSales.map(p => {
            const c = clientById.get(p.client_id);
            const coach = c?.assigned_coach_id ? coachById.get(c.assigned_coach_id)?.name || "—" : "—";
            return `<tr style="border-bottom:1px solid #1f2a23">
              <td style="padding:8px 0;color:#e0e0e0;font-size:13px">${c?.name || "—"}<br><span style="color:#666;font-size:11px">${c?.email || ""}</span></td>
              <td style="padding:8px 0;color:#a5b4fc;font-size:12px">${coach}</td>
              <td style="padding:8px 0;color:#c4e9bf;font-weight:700;font-size:14px;text-align:right">${fmt(Number(p.amount_cents) / 100, p.currency)}</td>
            </tr>`;
          }).join("")
        }</table>`;

    const refundsHtml = newRefunds.length === 0
      ? `<p style="color:#888;font-size:13px;font-style:italic">Няма възстановявания.</p>`
      : newRefunds.map(p => `<p style="color:#FBBF24;font-size:13px;margin:4px 0">${(Number(p.amount_cents)/100).toFixed(0)} ${p.currency.toUpperCase()} · ${(p.refunded_at || "").slice(0, 16)}</p>`).join("");

    const flagsHtml = [
      activeWithoutCoach.length > 0 ? `<li style="color:#F87171">${activeWithoutCoach.length} активни клиенти без назначен ментор</li>` : "",
      disputed.length > 0 ? `<li style="color:#F87171">${disputed.length} спорни плащания (chargeback) — изискват действие</li>` : "",
      expiringSoon.length > 0 ? `<li style="color:#FBBF24">${expiringSoon.length} програми изтичат в следващите 7 дни</li>` : "",
    ].filter(Boolean).join("");

    const html = `
      <div style="font-family:sans-serif;padding:24px;background:#0d1510;color:#e0e0e0;border-radius:16px;max-width:600px;margin:0 auto">
        <h1 style="color:#c4e9bf;margin:0 0 4px;font-size:24px">SYNRG · Дневен отчет</h1>
        <p style="color:#888;margin:0 0 24px;font-size:13px">${dateLabel}</p>

        <h2 style="color:#c4e9bf;margin:0 0 8px;font-size:15px;letter-spacing:0.05em">📊 ВЧЕРА</h2>
        <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
          ${row("Нови покупки", String(newSales.length), "#c4e9bf")}
          ${row("Приход", fmt(newSalesRevenue, newSales[0]?.currency || "EUR"), "#c4e9bf")}
          ${newRefunds.length > 0 ? row("Възстановявания", `${newRefunds.length} · ${fmt(refundedSum, newRefunds[0]?.currency || "EUR")}`, "#FBBF24") : ""}
        </table>

        ${newSales.length > 0 ? `
          <h2 style="color:#a5b4fc;margin:24px 0 8px;font-size:15px;letter-spacing:0.05em">👥 НОВИ КЛИЕНТИ</h2>
          ${newSalesHtml}
        ` : ""}

        ${newRefunds.length > 0 ? `
          <h2 style="color:#FBBF24;margin:24px 0 8px;font-size:15px;letter-spacing:0.05em">↩️ ВЪЗСТАНОВЯВАНИЯ</h2>
          ${refundsHtml}
        ` : ""}

        <h2 style="color:#c4e9bf;margin:24px 0 8px;font-size:15px;letter-spacing:0.05em">🟢 ОБЩА КАРТИНА</h2>
        <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
          ${row("Активни програми", String(activeNow.length))}
          ${row("Активен приход", fmt(activeRevenue, "EUR"), "#c4e9bf")}
          ${row("Изтичат тази седмица", String(expiringSoon.length), expiringSoon.length > 0 ? "#FBBF24" : "#e0e0e0")}
          ${row("Без ментор", String(activeWithoutCoach.length), activeWithoutCoach.length > 0 ? "#F87171" : "#e0e0e0")}
        </table>

        ${flagsHtml ? `
          <h2 style="color:#F87171;margin:24px 0 8px;font-size:15px;letter-spacing:0.05em">⚠️ ИЗИСКВА ВНИМАНИЕ</h2>
          <ul style="margin:0;padding-left:20px;font-size:13px;line-height:1.7">${flagsHtml}</ul>
        ` : ""}

        <hr style="border:none;border-top:1px solid #1f2a23;margin:32px 0 16px">
        <p style="color:#666;font-size:11px;margin:0">SYNRG Beyond Fitness · Синерджи 93 ООД · ЕИК 207343690</p>
        <p style="color:#666;font-size:11px;margin:4px 0 0">Авто-генериран отчет. Виж пълно: Admin → Клиенти → Онлайн</p>
      </div>`;

    const subject = newSales.length > 0
      ? `SYNRG · ${newSales.length} нов${newSales.length === 1 ? "а" : "и"} продажб${newSales.length === 1 ? "а" : "и"} · ${fmt(newSalesRevenue, newSales[0]?.currency || "EUR")}`
      : `SYNRG · Дневен отчет · ${dateLabel}`;

    for (const email of DIGEST_RECIPIENTS) {
      await sendEmail(email, subject, html);
    }

    return new Response(JSON.stringify({
      ok: true,
      summary: {
        newSales: newSales.length,
        newSalesRevenue,
        refunds: newRefunds.length,
        activeTotal: activeNow.length,
        activeRevenue,
        flags: { activeWithoutCoach: activeWithoutCoach.length, disputed: disputed.length, expiringSoon: expiringSoon.length },
      },
    }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    console.error("daily-sales-digest failed:", e);
    return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
