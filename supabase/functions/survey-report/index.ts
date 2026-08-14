/**
 * Supabase Edge Function: Survey Report
 *
 * Обобщава анонимната анкета (/anketa/) и я праща по имейл.
 *
 * Отговорите се четат САМО оттук, със сервизния ключ. Анонимната роля няма
 * право на SELECT — това е нарочно и е единствената причина анкетата да може
 * да се нарече анонимна. Не давай SELECT на anon, за да си спестиш тази функция.
 *
 * Deploy:
 *   npx supabase functions deploy survey-report --no-verify-jwt --project-ref nzrtdqlgljcipfmectwp
 *
 * Call:
 *   POST .../functions/v1/survey-report
 *   Authorization: Bearer <REPORT_EMAIL_TOKEN>
 *   {}                  → праща имейл
 *   { dry_run: true }   → връща числата без имейл
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY")!;
const REPORT_EMAIL_TOKEN = Deno.env.get("REPORT_EMAIL_TOKEN")!;

const RECIPIENT = "info@synrg-beyondfitness.com";
const SENDER = { name: "SYNRG Отчети", email: "info@synrg-beyondfitness.com" };

const BG = "#111311", CARD = "#1a1c1a", ACC = "#c4e9bf",
  MUT = "#8a938a", LINE = "#2a2e2a", TXT = "#e8ece8", WARN = "#e0b98a", BAD = "#e08a8a";

const SCALES: [string, string][] = [
  ["q1_overall", "Доволство от SYNRG като цяло"],
  ["q2_attention", "Лично внимание от треньорите"],
  ["q3_understood", "Чувстват се разбрани и изслушани"],
  ["q4_tailored", "Тренировките съобразени с тях"],
  ["q8_cleanliness", "Чистота и подредба"],
];
const CHOICES: [string, string][] = [
  ["q5_results", "Виждат ли резултат"],
  ["q6_progress", "Знаят ли какъв прогрес имат"],
];
const TEXTS: [string, string][] = [
  ["q7_value", "Най-важното, което SYNRG им дава"],
  ["q9_annoyance", "Какво ги дразни в екипа"],
  ["q10_best", "Какво харесват най-много"],
  ["q11_change", "Какво биха променили"],
  ["q13_anything", "Каквото не сме попитали"],
];

const esc = (s: string) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

function avg(rows: Row[], key: string): number | null {
  const v = rows.map((r) => r[key]).filter((x) => typeof x === "number");
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

/** Колко пъти е дадена всяка стойност — средното крие единиците, това не ги крие. */
function dist(rows: Row[], key: string, from: number, to: number): number[] {
  const out = new Array(to - from + 1).fill(0);
  rows.forEach((r) => {
    const v = r[key];
    if (typeof v === "number" && v >= from && v <= to) out[v - from]++;
  });
  return out;
}

function section(title: string, inner: string) {
  return `<div style="font:700 15px/1.3 Arial,sans-serif;color:${ACC};padding:26px 0 10px">${title}</div>${inner}`;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "POST only" }), { status: 405 });
  }
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!REPORT_EMAIL_TOKEN || token !== REPORT_EMAIL_TOKEN) {
    return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), { status: 401 });
  }
  let body: { dry_run?: boolean; only_if_new?: boolean };
  try { body = await req.json(); } catch { body = {}; }

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/survey_responses?select=*&order=created_at.asc`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
  );
  if (!res.ok) {
    return new Response(JSON.stringify({ ok: false, error: "read failed", detail: await res.text() }), { status: 502 });
  }
  const rows = await res.json() as Row[];
  const n = rows.length;

  // NPS: промоутъри (9–10) минус критици (0–6), в проценти.
  const nps = rows.map((r) => r.q12_nps).filter((x) => typeof x === "number");
  const prom = nps.filter((v) => v >= 9).length;
  const pass = nps.filter((v) => v >= 7 && v <= 8).length;
  const detr = nps.filter((v) => v <= 6).length;
  const npsScore = nps.length ? Math.round(((prom - detr) / nps.length) * 100) : null;

  const summary = {
    responses: n,
    nps: npsScore,
    promoters: prom, passives: pass, detractors: detr,
    averages: Object.fromEntries(SCALES.map(([k, l]) => [l, avg(rows, k)?.toFixed(2) ?? null])),
  };

  if (body.dry_run) {
    return new Response(JSON.stringify({ ok: true, dry_run: true, summary }), {
      headers: { "Content-Type": "application/json" },
    });
  }
  if (!n) {
    return new Response(JSON.stringify({ ok: true, skipped: "няма отговори" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // Дневният крон вика с only_if_new: мълчи в дните без нови попълвания, вместо
  // да праща един и същи отчет всяка сутрин. Имейл, който не носи новина, се
  // превръща в имейл, който не се отваря.
  if (body.only_if_new) {
    const since = Date.now() - 24 * 60 * 60 * 1000;
    const fresh = rows.filter((r) => new Date(r.created_at).getTime() >= since).length;
    if (!fresh) {
      return new Response(JSON.stringify({ ok: true, skipped: "няма нови от 24ч", total: n }), {
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // ── разпределение по скалите: всяка стойност 1–5 с брой, за да се виждат крайностите
  const cell = (c: number, color: string, weight = "700") =>
    `<td align="center" style="font:${weight} 14px/1.4 Arial,sans-serif;color:${c ? color : LINE};` +
    `padding:8px 4px;border-bottom:1px solid ${LINE}">${c || "·"}</td>`;

  const scaleHead = `<tr>
    <th align="left" style="font:700 11px/1.3 Arial,sans-serif;color:${MUT};text-transform:uppercase;padding:7px 6px;border-bottom:1px solid ${LINE}">Въпрос</th>
    ${[1, 2, 3, 4, 5].map((i) =>
      `<th align="center" style="font:700 11px/1.3 Arial,sans-serif;color:${i <= 2 ? BAD : (i === 5 ? ACC : MUT)};padding:7px 4px;border-bottom:1px solid ${LINE};width:34px">${i}</th>`
    ).join("")}
    <th align="right" style="font:700 11px/1.3 Arial,sans-serif;color:${MUT};text-transform:uppercase;padding:7px 6px;border-bottom:1px solid ${LINE}">Ср.</th>
  </tr>`;

  const scaleRows = SCALES.map(([k, label]) => {
    const a = avg(rows, k);
    const d = dist(rows, k, 1, 5);
    return `<tr>
      <td style="font:400 13px/1.4 Arial,sans-serif;color:${TXT};padding:8px 6px;border-bottom:1px solid ${LINE}">${label}</td>
      ${cell(d[0], BAD)}${cell(d[1], BAD)}${cell(d[2], WARN, "400")}${cell(d[3], TXT, "400")}${cell(d[4], ACC)}
      <td align="right" style="font:700 14px/1.4 Arial,sans-serif;color:${a !== null && a < 3.5 ? WARN : TXT};padding:8px 6px;border-bottom:1px solid ${LINE}">${a === null ? "—" : a.toFixed(2)}</td>
    </tr>`;
  }).join("");

  // ── разпределение на NPS 0–10, за да си личат нулите и десетките поотделно
  const npsDist = dist(rows, "q12_nps", 0, 10);
  const npsHead = `<tr>${npsDist.map((_, i) =>
    `<th align="center" style="font:700 11px/1.3 Arial,sans-serif;color:${i <= 6 ? BAD : (i >= 9 ? ACC : MUT)};padding:7px 2px;border-bottom:1px solid ${LINE}">${i}</th>`
  ).join("")}</tr>`;
  const npsRow = `<tr>${npsDist.map((c, i) =>
    `<td align="center" style="font:700 14px/1.4 Arial,sans-serif;color:${c ? (i <= 6 ? BAD : (i >= 9 ? ACC : TXT)) : LINE};padding:8px 2px">${c || "·"}</td>`
  ).join("")}</tr>`;

  // ── разпределения по избор
  const choiceBlocks = CHOICES.map(([k, label]) => {
    const counts = new Map<string, number>();
    rows.forEach((r) => { if (r[k]) counts.set(r[k], (counts.get(r[k]) || 0) + 1); });
    const total = [...counts.values()].reduce((a, b) => a + b, 0) || 1;
    const items = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([opt, c]) =>
      `<tr>
        <td style="font:400 13px/1.4 Arial,sans-serif;color:${TXT};padding:6px">${esc(opt)}</td>
        <td align="right" style="font:700 13px/1.4 Arial,sans-serif;color:${ACC};padding:6px;white-space:nowrap">${c} · ${Math.round((c / total) * 100)}%</td>
      </tr>`).join("");
    return `<div style="font:700 13px/1.3 Arial,sans-serif;color:${TXT};padding:14px 0 4px">${label}</div>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:${CARD};border:1px solid ${LINE};border-radius:10px">${items}</table>`;
  }).join("");

  // ── свободните отговори, дословно
  const textBlocks = TEXTS.map(([k, label]) => {
    const answers = rows.map((r) => r[k]).filter((x) => x && String(x).trim());
    if (!answers.length) return "";
    const items = answers.map((a) =>
      `<div style="font:400 13px/1.55 Arial,sans-serif;color:${TXT};padding:10px 12px;background:${CARD};border-left:2px solid ${ACC};border-radius:0 8px 8px 0;margin-bottom:7px">${esc(a)}</div>`
    ).join("");
    return `<div style="font:700 13px/1.3 Arial,sans-serif;color:${TXT};padding:18px 0 8px">${label} <span style="color:${MUT};font-weight:400">· ${answers.length} отговора</span></div>${items}`;
  }).join("");

  const kpi = (v: string, l: string, c = ACC) =>
    `<td align="center" style="padding:14px 8px;background:${CARD};border:1px solid ${LINE};border-radius:10px">
      <div style="font:700 22px/1.1 Arial,sans-serif;color:${c}">${v}</div>
      <div style="font:400 11px/1.4 Arial,sans-serif;color:${MUT};text-transform:uppercase;letter-spacing:.5px;padding-top:5px">${l}</div></td>`;

  const html = `<div style="background:${BG};padding:26px 16px;font-family:Arial,sans-serif">
<div style="max-width:720px;margin:0 auto">
<div style="font:700 20px/1.3 Arial,sans-serif;color:${TXT}">SYNRG · Анкета за клиенти</div>
<div style="font:400 13px/1.4 Arial,sans-serif;color:${MUT};padding:4px 0 18px">${n} попълнени · анонимно</div>
<table width="100%" cellpadding="0" cellspacing="6" style="border-collapse:separate"><tr>
${kpi(String(n), "отговора")}
${kpi(npsScore === null ? "—" : String(npsScore), "NPS", npsScore !== null && npsScore < 0 ? WARN : ACC)}
${kpi(String(prom), "промоутъри")}
${kpi(String(detr), "критици", detr > prom ? WARN : ACC)}
</tr></table>
<div style="font:400 12px/1.6 Arial,sans-serif;color:${MUT};padding:12px 0 0">
NPS = процент промоутъри (9–10) минус процент критици (0–6). Пасивните (7–8) са ${pass}. Скалите под 3,5 са оцветени — там има какво да се оправя.
</div>
${section("Оценки по скалата — брой отговори на всяка стойност", `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">${scaleHead}${scaleRows}</table><div style="font:400 11.5px/1.5 Arial,sans-serif;color:${MUT};padding:9px 0 0">Всяко число е брой хора, дали тази оценка. Единиците и двойките са в червено — те са важните, дори когато са една-две и средното изглежда добре.</div>`)}
${section("Препоръчване (NPS) — кой какво е дал", `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:${CARD};border:1px solid ${LINE};border-radius:10px">${npsHead}${npsRow}</table><div style="font:400 11.5px/1.5 Arial,sans-serif;color:${MUT};padding:9px 0 0">0–6 критици · 7–8 пасивни · 9–10 промоутъри.</div>`)}
${section("Резултат и прогрес", choiceBlocks)}
${section("Какво пишат", textBlocks || `<div style="color:${MUT};font-size:13px">Няма свободни отговори.</div>`)}
<div style="font:400 11px/1.5 Arial,sans-serif;color:${MUT};padding:24px 0 0;border-top:1px solid ${LINE};margin-top:22px">
Автоматичен отчет · survey-report · отговорите са анонимни и не могат да се свържат с конкретен клиент
</div></div></div>`;

  const send = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      sender: SENDER,
      to: [{ email: RECIPIENT }],
      subject: `SYNRG · Анкета — ${n} отговора`,
      htmlContent: html,
    }),
  });
  if (!send.ok) {
    return new Response(JSON.stringify({ ok: false, error: "brevo failed", detail: await send.text(), summary }), { status: 502 });
  }
  return new Response(JSON.stringify({ ok: true, to: RECIPIENT, summary }), {
    headers: { "Content-Type": "application/json" },
  });
});
