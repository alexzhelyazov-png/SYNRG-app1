/**
 * Supabase Edge Function: Studio Monthly Report
 *
 * Месечен отчет за студио клиентите: свалени килограми (начално / текущо / разлика),
 * брой тренировки и кой изобщо не се мери. Изпраща се по имейл на екипа.
 *
 * Данните идват от SQL функцията public.studio_monthly_report(p_start, p_end),
 * за да не се дублира логиката между отчета и ad-hoc справките.
 *
 * Deploy:
 *   npx supabase functions deploy studio-monthly-report --no-verify-jwt --project-ref nzrtdqlgljcipfmectwp
 *
 * Call:
 *   POST .../functions/v1/studio-monthly-report
 *   Authorization: Bearer <REPORT_EMAIL_TOKEN>
 *   {}                          → предходния месец
 *   { "month": "2026-07" }      → конкретен месец
 *   { "dry_run": true }         → връща числата без да праща имейл
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY")!;
const REPORT_EMAIL_TOKEN = Deno.env.get("REPORT_EMAIL_TOKEN")!;

const RECIPIENT = "info@synrg-beyondfitness.com";
const SENDER = { name: "SYNRG Отчети", email: "info@synrg-beyondfitness.com" };

const BG_MONTHS = ["януари", "февруари", "март", "април", "май", "юни",
  "юли", "август", "септември", "октомври", "ноември", "декември"];

const BG = "#111311", CARD = "#1a1c1a", ACC = "#c4e9bf",
  MUT = "#8a938a", LINE = "#2a2e2a", TXT = "#e8ece8",
  POS = "#7fd18f", NEG = "#e08a8a", WARN = "#e0b98a";

type Row = {
  name: string; plan: string; done: number; canc: number; n: number;
  nachalno: number | null; tekusto: number | null; razlika: number | null;
};

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const f1 = (v: number | null) => (v === null ? "—" : v.toFixed(1));
const sgn = (v: number | null) => (v === null ? "—" : (v > 0 ? "+" : "") + v.toFixed(1));

function kpi(value: string, label: string, color = ACC) {
  return `<td align="center" style="padding:14px 8px;background:${CARD};border:1px solid ${LINE};border-radius:10px">
<div style="font:700 22px/1.1 Arial,sans-serif;color:${color}">${value}</div>
<div style="font:400 11px/1.4 Arial,sans-serif;color:${MUT};text-transform:uppercase;letter-spacing:.5px;padding-top:5px">${label}</div></td>`;
}

function table(rows: Row[], title: string, sub: string, showWeight = true) {
  const cols = ["Клиент", "План", "Трен.", "Отк.", "Впис."]
    .concat(showWeight ? ["Начално", "Текущо", "Разлика"] : []);
  const th = cols.map((c, i) =>
    `<th align="${i === 0 ? "left" : "right"}" style="font:700 11px/1.3 Arial,sans-serif;color:${MUT};text-transform:uppercase;padding:7px 6px;border-bottom:1px solid ${LINE}">${c}</th>`
  ).join("");

  const body = rows.map((r) => {
    const col = r.razlika === null ? MUT : r.razlika < 0 ? POS : r.razlika > 0 ? NEG : MUT;
    const td = (v: string, c = MUT, w = "400") =>
      `<td align="right" style="font:${w} 13px/1.3 Arial,sans-serif;color:${c};padding:7px 6px;border-bottom:1px solid ${LINE}">${v}</td>`;
    let cells =
      `<td style="font:600 13px/1.3 Arial,sans-serif;color:${TXT};padding:7px 6px;border-bottom:1px solid ${LINE}">${esc(r.name || "—")}</td>` +
      td(esc(r.plan || "—")) + td(String(r.done), TXT) + td(String(r.canc)) + td(String(r.n));
    if (showWeight) {
      cells += td(f1(r.nachalno)) + td(f1(r.tekusto), TXT) + td(sgn(r.razlika), col, "700");
    }
    return `<tr>${cells}</tr>`;
  }).join("");

  return `<div style="font:700 15px/1.3 Arial,sans-serif;color:${ACC};padding:26px 0 3px">${title}</div>
<div style="font:400 12px/1.4 Arial,sans-serif;color:${MUT};padding-bottom:10px">${sub}</div>
<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr>${th}</tr>${body}</table>`;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "POST only" }), { status: 405 });
  }
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!REPORT_EMAIL_TOKEN || token !== REPORT_EMAIL_TOKEN) {
    return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), { status: 401 });
  }

  let body: { month?: string; dry_run?: boolean };
  try { body = await req.json(); } catch { body = {}; }

  // По подразбиране: предходният календарен месец.
  let year: number, month: number;
  if (body.month && /^\d{4}-\d{2}$/.test(body.month)) {
    [year, month] = body.month.split("-").map(Number);
    month -= 1;
  } else {
    const now = new Date();
    const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    year = prev.getUTCFullYear();
    month = prev.getUTCMonth();
  }
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 0));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const label = `${BG_MONTHS[month]} ${year}`;

  const rpc = await fetch(`${SUPABASE_URL}/rest/v1/rpc/studio_monthly_report`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_start: iso(start), p_end: iso(end) }),
  });
  if (!rpc.ok) {
    return new Response(JSON.stringify({ ok: false, error: "rpc failed", detail: await rpc.text() }), { status: 502 });
  }
  const raw = await rpc.json() as Row[];
  const rows: Row[] = raw.map((r) => ({
    ...r,
    nachalno: r.nachalno === null ? null : Number(r.nachalno),
    tekusto: r.tekusto === null ? null : Number(r.tekusto),
    razlika: r.razlika === null ? null : Number(r.razlika),
  }));

  const logged = rows.filter((r) => r.n > 0);
  const loss = logged.filter((r) => r.razlika! < 0).sort((a, b) => a.razlika! - b.razlika!);
  const flat = logged.filter((r) => r.razlika! >= 0).sort((a, b) => b.razlika! - a.razlika!);
  const nolog = rows.filter((r) => r.n === 0).sort((a, b) => b.done - a.done);

  const avg = logged.length ? logged.reduce((s, r) => s + r.razlika!, 0) / logged.length : 0;
  const totalLost = -loss.reduce((s, r) => s + r.razlika!, 0);
  const trainings = rows.reduce((s, r) => s + r.done, 0);
  const cancels = rows.reduce((s, r) => s + r.canc, 0);
  const pctNolog = rows.length ? Math.round((nolog.length / rows.length) * 100) : 0;

  const summary = {
    month: `${year}-${String(month + 1).padStart(2, "0")}`,
    clients: rows.length, logged: logged.length, lost: loss.length,
    avgKg: Number(avg.toFixed(2)), totalLostKg: Number(totalLost.toFixed(1)),
    trainings, cancels, notWeighing: nolog.length,
  };

  if (body.dry_run) {
    return new Response(JSON.stringify({ ok: true, dry_run: true, summary }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const html = `<div style="background:${BG};padding:26px 16px;font-family:Arial,sans-serif">
<div style="max-width:720px;margin:0 auto">
<div style="font:700 20px/1.3 Arial,sans-serif;color:${TXT}">SYNRG · Месечен отчет студио</div>
<div style="font:400 13px/1.4 Arial,sans-serif;color:${MUT};padding:4px 0 18px">${label} · ${rows.length} активни студио клиенти</div>
<table width="100%" cellpadding="0" cellspacing="6" style="border-collapse:separate"><tr>
${kpi(`${avg > 0 ? "+" : ""}${avg.toFixed(2)} кг`, "средно свалено")}
${kpi(`${totalLost.toFixed(1)} кг`, "общо свалени")}
${kpi(String(trainings), "тренировки")}
${kpi(String(nolog.length), "не се мерят", WARN)}
</tr></table>
<div style="font:400 12px/1.6 Arial,sans-serif;color:${MUT};padding:12px 0 0">
Средното е от ${logged.length} души, които са се мерили поне веднъж през месеца. Тренировките са резервирани и неотказани часове (${cancels} отказани) — не потвърдено присъствие. При под 5 вписвания разликата в килограми е ориентировъчна.
</div>
${table(loss, `1 · Свалили тегло — ${loss.length} души`, "Подредени по най-много свалени килограми.")}
${table(flat, `2 · Без промяна или нагоре — ${flat.length} души`, "Мерят се, но резултатът не помръдва.")}
${table(nolog, `3 · Не се мерят — ${nolog.length} от ${rows.length} (${pctNolog}%)`, "Нито едно вписване през месеца. Подредени по брой тренировки — най-отгоре са най-ангажираните без измерим резултат.", false)}
<div style="font:400 11px/1.5 Arial,sans-serif;color:${MUT};padding:24px 0 0;border-top:1px solid ${LINE};margin-top:22px">
Автоматичен отчет · studio-monthly-report · генериран от данните в Supabase
</div></div></div>`;

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      sender: SENDER,
      to: [{ email: RECIPIENT }],
      subject: `SYNRG · Месечен отчет студио — ${label}`,
      htmlContent: html,
    }),
  });
  if (!res.ok) {
    return new Response(JSON.stringify({ ok: false, error: "brevo failed", detail: await res.text(), summary }), { status: 502 });
  }
  return new Response(JSON.stringify({ ok: true, to: RECIPIENT, summary }), {
    headers: { "Content-Type": "application/json" },
  });
});
