/**
 * Supabase Edge Function: Ads Evening Report (server-side, reliable)
 *
 * Replaces the Claude scheduled task with a fully server-side nightly report so
 * delivery does NOT depend on any app being open. Runs via Supabase pg_cron at
 * 17:00 UTC (= 20:00 BG summer / EEST). NOTE: pg_cron is UTC-only; in winter
 * (EET, UTC+2) this lands at 19:00 BG — adjust the cron to '0 18 * * *' then.
 *
 * Pulls TODAY's campaign performance + LP funnel directly from the Meta Graph
 * API (ad-attributed pixel actions), then emails the SYNRG team via Brevo.
 *
 * Secrets required:
 *   META_ACCESS_TOKEN   — long-lived/system-user token with ads_read on the account
 *   BREVO_API_KEY       — already set
 *   REPORT_EMAIL_TOKEN  — shared bearer to guard this endpoint (already set)
 *
 * Deploy:
 *   npx supabase functions deploy ads-evening-report --no-verify-jwt --project-ref nzrtdqlgljcipfmectwp
 *
 * Manual test:
 *   curl -X POST <fn-url> -H 'Authorization: Bearer <REPORT_EMAIL_TOKEN>'
 */

const META_ACCESS_TOKEN = Deno.env.get("META_ACCESS_TOKEN") || "";
const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY")!;
const REPORT_EMAIL_TOKEN = Deno.env.get("REPORT_EMAIL_TOKEN")!;

const GRAPH = "https://graph.facebook.com/v21.0";
const AD_ACCOUNT = "645285578052613"; // SYNRG стар (EUR) — active sales campaign
const RECIPIENT = "info@synrg-beyondfitness.com";
const SENDER = { name: "SYNRG Ads Report", email: "info@synrg-beyondfitness.com" };

const BG_MONTHS = ["януари","февруари","март","април","май","юни","юли","август","септември","октомври","ноември","декември"];

// Pixel action types we care about (ad-attributed). Meta returns the SAME
// conversion under several aliases (view_content, omni_view_content,
// onsite_web_view_content, offsite_conversion.fb_pixel_view_content ...), each
// with the same value — so we MUST match ONE exact canonical type, never a
// suffix, otherwise the count is multiplied by the number of aliases.
const ACTION_TYPE = {
  view_content: "offsite_conversion.fb_pixel_view_content",
  initiate_checkout: "offsite_conversion.fb_pixel_initiate_checkout",
  purchase: "offsite_conversion.fb_pixel_purchase",
  lead: "lead",
};

interface AdRow {
  ad_name?: string;
  spend?: string;
  impressions?: string;
  inline_link_clicks?: string;
  ctr?: string;
  actions?: { action_type: string; value: string }[];
}

function sumAction(actions: { action_type: string; value: string }[] | undefined, exactType: string): number {
  if (!actions) return 0;
  return actions
    .filter(a => a.action_type === exactType)
    .reduce((s, a) => s + Number(a.value || 0), 0);
}

async function fetchTodayInsights(): Promise<AdRow[]> {
  const url = `${GRAPH}/act_${AD_ACCOUNT}/insights`
    + `?level=ad`
    + `&date_preset=today`
    + `&fields=ad_name,spend,impressions,inline_link_clicks,ctr,actions`
    + `&limit=200`
    + `&access_token=${encodeURIComponent(META_ACCESS_TOKEN)}`;
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok || json.error) {
    throw new Error(`Graph insights failed: ${res.status} ${JSON.stringify(json.error || json)}`);
  }
  return Array.isArray(json.data) ? json.data : [];
}

async function sendEmail(subject: string, html: string) {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      sender: SENDER,
      to: [{ email: RECIPIENT }],
      subject,
      htmlContent: html,
      headers: { "X-Mailer": "SYNRG Ads Evening Report" },
    }),
  });
  if (!res.ok) throw new Error(`Brevo ${res.status}: ${await res.text()}`);
}

function eur(n: number): string {
  return "€" + n.toFixed(2);
}

function buildHtml(rows: AdRow[], d: Date): string {
  const dateLabel = `${d.getUTCDate()} ${BG_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;

  let spend = 0, impressions = 0, linkClicks = 0;
  let viewContent = 0, initiateCheckout = 0, purchase = 0, lead = 0;
  const perAd: { name: string; spend: number; linkClicks: number; ctr: string }[] = [];

  for (const r of rows) {
    const s = Number(r.spend || 0);
    const imp = Number(r.impressions || 0);
    const lc = Number(r.inline_link_clicks || 0);
    spend += s; impressions += imp; linkClicks += lc;
    viewContent      += sumAction(r.actions, ACTION_TYPE.view_content);
    initiateCheckout += sumAction(r.actions, ACTION_TYPE.initiate_checkout);
    purchase         += sumAction(r.actions, ACTION_TYPE.purchase);
    lead             += sumAction(r.actions, ACTION_TYPE.lead);
    perAd.push({ name: r.ad_name || "—", spend: s, linkClicks: lc, ctr: r.ctr || "0" });
  }

  const ordersStarted = initiateCheckout + lead;
  const clickToLp = linkClicks > 0 ? Math.round((viewContent / linkClicks) * 100) : 0;
  const lpToOrder = viewContent > 0 ? Math.round((ordersStarted / viewContent) * 100) : 0;

  const perAdHtml = perAd
    .sort((a, b) => b.spend - a.spend)
    .map(a => `<div style="color:#9aa39a;font-size:12px;margin:2px 0">${a.name} · ${eur(a.spend)} · ${a.linkClicks} клика · CTR ${Number(a.ctr).toFixed(1)}%</div>`)
    .join("");

  const row = (label: string, value: string, color = "#e0e0e0") =>
    `<tr><td style="color:#888;padding:6px 12px 6px 0;font-size:13px">${label}</td><td style="color:${color};font-weight:700;padding:6px 0;font-size:15px;text-align:right">${value}</td></tr>`;

  const note = linkClicks < 100
    ? `<p style="color:#9aa39a;font-size:12px;font-style:italic;margin:12px 0 0">Извадката е още малка (&lt;100 клика общо за деня) — рано е за категорични изводи.</p>`
    : "";

  return `
  <div style="font-family:sans-serif;padding:24px;background:#0d1510;color:#e0e0e0;border-radius:16px;max-width:600px;margin:0 auto">
    <h1 style="color:#c4e9bf;margin:0 0 4px;font-size:22px">SYNRG · Вечерен отчет реклами</h1>
    <p style="color:#888;margin:0 0 20px;font-size:13px">${dateLabel}</p>

    <h2 style="color:#c4e9bf;margin:0 0 8px;font-size:14px;letter-spacing:0.05em">КАМПАНИЯ ДНЕС</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:8px">
      ${row("Похарчено", eur(spend), "#c4e9bf")}
      ${row("Импресии", String(impressions))}
      ${row("Кликове към сайта", String(linkClicks))}
    </table>
    ${perAdHtml}

    <h2 style="color:#c4e9bf;margin:24px 0 8px;font-size:14px;letter-spacing:0.05em">ЛП ФУНЕЛ ДНЕС</h2>
    <table style="width:100%;border-collapse:collapse">
      ${row("Кликове към сайта", String(linkClicks))}
      ${row("Разгледаха офертата (ViewContent)", String(viewContent), "#c4e9bf")}
      ${row("Започнаха поръчка (Checkout+Lead)", String(ordersStarted), ordersStarted > 0 ? "#c4e9bf" : "#e0e0e0")}
      ${row("Покупки", String(purchase), purchase > 0 ? "#c4e9bf" : "#e0e0e0")}
    </table>
    <p style="color:#9aa39a;font-size:12px;margin:10px 0 0">Клик→ЛП: <strong style="color:#e0e0e0">${clickToLp}%</strong> · ЛП→поръчка: <strong style="color:#e0e0e0">${lpToOrder}%</strong></p>
    ${note}

    <hr style="border:none;border-top:1px solid #1f2a23;margin:28px 0 14px">
    <p style="color:#666;font-size:11px;margin:0">Авто-генериран сървърен отчет · Meta Graph API · SYNRG Beyond Fitness</p>
  </div>`;
}

Deno.serve(async (req: Request) => {
  // Guard: shared bearer token
  const auth = req.headers.get("Authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!REPORT_EMAIL_TOKEN || token !== REPORT_EMAIL_TOKEN) {
    return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json" },
    });
  }

  if (!META_ACCESS_TOKEN) {
    return new Response(JSON.stringify({ ok: false, error: "META_ACCESS_TOKEN not set" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const rows = await fetchTodayInsights();
    const now = new Date();
    const html = buildHtml(rows, now);

    // Quick numbers for subject line
    let spend = 0, vc = 0, orders = 0;
    for (const r of rows) {
      spend += Number(r.spend || 0);
      vc += sumAction(r.actions, ACTION_TYPE.view_content);
      orders += sumAction(r.actions, ACTION_TYPE.initiate_checkout) + sumAction(r.actions, ACTION_TYPE.lead);
    }
    const subject = `SYNRG · ЛП отчет · ${vc} прегледа / ${orders} поръчки · ${eur(spend)}`;

    await sendEmail(subject, html);
    return new Response(JSON.stringify({ ok: true, spend, viewContent: vc, ordersStarted: orders }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // Best-effort: email the failure so silence never hides a problem again.
    try { await sendEmail("SYNRG · Вечерен отчет реклами — ГРЕШКА", `<pre>${msg}</pre>`); } catch { /* ignore */ }
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});
