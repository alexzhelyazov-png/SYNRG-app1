/**
 * Supabase Edge Function: email-automation
 *
 * Runs hourly (via cron) and triggers timed email sequences:
 *
 * Post-purchase (program_purchases):
 *   Day 1  → "Първи стъпки"
 *   Day 3  → "Как е първата седмица?"
 *   Day 7  → "Прогрес преглед"
 *   Day 14 → "Време за progress photos"
 *   Day 28 → "Половината мина — продължи"
 *   Day 56 → "Завърши — дай ревю"
 *
 * Free user nurturing (clients without purchase):
 *   Day 7   → "Готов ли си за следващото ниво?"
 *   Day 14  → "15% отстъпка за първи 100"
 *   Day 30  → "Какво те спира?"
 *
 * Inactive re-engagement:
 *   No login + no logs 14 days → "Връщаме ти достъп"
 *
 * Idempotency: every send is logged in `email_sends`. Same key never sends twice per client.
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BREVO_API = "https://api.brevo.com/v3";
const BREVO_KEY = Deno.env.get("BREVO_API_KEY")!;

const SENDER = { name: "SYNRG Beyond Fitness", email: "info@synrg-beyondfitness.com" };
const APP_URL = "https://synrg-beyondfitness.com/app/";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function sbHeaders() {
  return {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    "Content-Type": "application/json",
  };
}

async function alreadySent(client_id: string, email_key: string): Promise<boolean> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/email_sends?select=id&client_id=eq.${client_id}&email_key=eq.${email_key}&limit=1`,
    { headers: sbHeaders() }
  );
  const data = await res.json();
  return Array.isArray(data) && data.length > 0;
}

async function logSent(client_id: string, email_key: string, success: boolean) {
  await fetch(`${SUPABASE_URL}/rest/v1/email_sends`, {
    method: "POST",
    headers: { ...sbHeaders(), Prefer: "return=minimal,resolution=ignore-duplicates" },
    body: JSON.stringify({ client_id, email_key, success }),
  });
}

async function sendBrevoEmail(to: { email: string; name: string }, subject: string, html: string): Promise<boolean> {
  try {
    const res = await fetch(`${BREVO_API}/smtp/email`, {
      method: "POST",
      headers: { "api-key": BREVO_KEY, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ sender: SENDER, to: [to], subject, htmlContent: html }),
    });
    return res.ok;
  } catch { return false; }
}

// ── DB-backed templates ─────────────────────────────────────────
type AutoRow = { key: string; subject: string; body_html: string; enabled: boolean };

async function loadAutomations(): Promise<Map<string, AutoRow>> {
  const m = new Map<string, AutoRow>();
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/email_automations?select=key,subject,body_html,enabled`, { headers: sbHeaders() });
    const rows = await res.json();
    if (Array.isArray(rows)) for (const r of rows) m.set(r.key, r);
  } catch (e) { console.error("loadAutomations failed:", e); }
  return m;
}

// Active studio clients (client_plans) — must be excluded from freemium upsell.
async function loadActiveStudioClientIds(): Promise<Set<string>> {
  const s = new Set<string>();
  try {
    const today = new Date().toISOString().slice(0, 10);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/client_plans?select=client_id,valid_to,extended_to&status=eq.active`, { headers: sbHeaders() });
    const rows = await res.json();
    if (Array.isArray(rows)) for (const r of rows) {
      const end = r.extended_to || r.valid_to;
      if (!end || end >= today) s.add(r.client_id);
    }
  } catch (e) { console.error("loadActiveStudioClientIds failed:", e); }
  return s;
}

const applyName = (s: string, name: string) => (s || "").replaceAll("{name}", name);

// Wrap inner body (DB-stored) with the shared email chrome.
const chrome = (inner: string) => `<div style="font-family:Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px;background:#1a1a1a;color:#e0e0e0;border-radius:16px;line-height:1.6">
  ${inner}
  <hr style="border:none;border-top:1px solid #333;margin:24px 0">
  <p style="font-size:11px;color:#666;margin:0">SYNRG Beyond Fitness · Синерджи 93 ООД · ЕИК 207343690</p>
  <p style="font-size:10px;color:#555;margin:8px 0 0">Получаваш този email защото си регистриран в SYNRG. <a href="${APP_URL}#/profile" style="color:#777">Настройки</a></p>
</div>`;

// Resolve a template for sending:
//  - row exists + disabled  → null (skip)
//  - row exists + enabled   → DB subject/body (chrome added)
//  - row missing            → hardcoded fallback (full html), so emails never go out empty
function resolveTemplate(
  autoMap: Map<string, AutoRow>,
  dbKey: string,
  name: string,
  fallback: (n: string) => { subject: string; html: string },
): { subject: string; html: string } | null {
  const row = autoMap.get(dbKey);
  if (row) {
    if (!row.enabled) return null;
    return { subject: applyName(row.subject, name), html: chrome(applyName(row.body_html, name)) };
  }
  return fallback(name);
}

// ── Email templates (hardcoded fallback) ────────────────────────
const wrap = (title: string, body: string) => `<div style="font-family:Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px;background:#1a1a1a;color:#e0e0e0;border-radius:16px;line-height:1.6">
  <h2 style="color:#c4e9bf;margin:0 0 16px;font-size:22px">${title}</h2>
  ${body}
  <hr style="border:none;border-top:1px solid #333;margin:24px 0">
  <p style="font-size:11px;color:#666;margin:0">SYNRG Beyond Fitness · Синерджи 93 ООД · ЕИК 207343690</p>
  <p style="font-size:10px;color:#555;margin:8px 0 0">Получаваш този email защото си регистриран в SYNRG. <a href="${APP_URL}#/profile" style="color:#777">Настройки</a></p>
</div>`;

const buttonCta = (text: string, url: string) =>
  `<div style="text-align:center;margin:24px 0"><a href="${url}" style="display:inline-block;background:#c4e9bf;color:#0d1510;padding:14px 28px;border-radius:99px;font-weight:800;text-decoration:none;font-size:14px">${text}</a></div>`;

const tmpl_buyer_d1 = (name: string) => ({
  subject: "SYNRG Метод — първите стъпки днес",
  html: wrap(`Здравей, ${name}!`, `
    <p>Радваме се че започваш SYNRG Метод. Следващите 8 седмици ще променят начина по който се чувстваш.</p>
    <p><strong>Днес направи 3 неща:</strong></p>
    <ul>
      <li>Влез в приложението и регистрирай теглото си (Прогрес → +Тегло)</li>
      <li>Запиши първата си седмица в календара</li>
      <li>Прочети Welcome съобщението от твоя ментор</li>
    </ul>
    ${buttonCta("Отвори приложението", APP_URL)}
    <p style="font-size:13px;color:#999">Имаш въпроси? Просто отговори на този email.</p>
  `),
});

const tmpl_buyer_d3 = (name: string) => ({
  subject: "Как мина първата ти седмица в SYNRG?",
  html: wrap(`${name},`, `
    <p>3 дни са от старта. Как си?</p>
    <p>Ако не си отварял app-а, стори го днес. Първата седмица е най-важната — затова и менторът ти е на разположение.</p>
    <p><strong>Tip:</strong> Логни поне 1 хранене и 1 тегло днес — това ще ти даде basis за сравнение.</p>
    ${buttonCta("Влез в SYNRG", APP_URL)}
  `),
});

const tmpl_buyer_d7 = (name: string) => ({
  subject: "1 седмица в SYNRG — твоят прогрес",
  html: wrap(`Поздравления, ${name}!`, `
    <p>Първата седмица е завършена. 🎯</p>
    <p>Време е да погледнеш напред:</p>
    <ul>
      <li>Сравни теглото от ден 1 с днес</li>
      <li>Колко тренировки записа?</li>
      <li>Имаш ли въпроси към ментора?</li>
    </ul>
    <p>Следващите 7 дни — фокус на хранителния режим. Менторът ти ще те преведе.</p>
    ${buttonCta("Виж прогреса", APP_URL + "#/progress")}
  `),
});

const tmpl_buyer_d14 = (name: string) => ({
  subject: "Време за progress photos",
  html: wrap(`${name},`, `
    <p>2 седмици в SYNRG Метод. Време е за първите progress photos!</p>
    <p>Снимай се сутрин на гладно от 4 ъгъла:</p>
    <ul>
      <li>Лице (отпред)</li>
      <li>Профил отстрани (ляв и десен)</li>
      <li>Гръб</li>
    </ul>
    <p>Запази ги локално — ще ги сравним след още 2 седмици.</p>
    <p>Прозиво от ментора: твоят progress е важен. Не пропускай.</p>
    ${buttonCta("Отвори SYNRG", APP_URL)}
  `),
});

const tmpl_buyer_d28 = (name: string) => ({
  subject: "Половината от програмата е зад теб",
  html: wrap(`${name},`, `
    <p>4 седмици в SYNRG Метод — middle point! 💪</p>
    <p>Време за оценка:</p>
    <ul>
      <li>Колко килограма промяна?</li>
      <li>Как се чувстваш в дрехите?</li>
      <li>Кое работи най-добре в режима?</li>
    </ul>
    <p>Ако нещо не ти е ясно — пиши на ментора. Втората половина е най-важна за затвърждаване на навиците.</p>
    ${buttonCta("Чат с ментора", APP_URL + "#/coach")}
  `),
});

const tmpl_buyer_d56_review = (name: string) => ({
  subject: "Завърши SYNRG Метод — споделяш ли ни опита си?",
  html: wrap(`${name}, поздравления!`, `
    <p>Завърши 8-седмичната програма. Това е истинско постижение.</p>
    <p><strong>Нашата молба:</strong> сподели опита си с другите.</p>
    <p>2-минутна оценка — ще покажем твоето ревю на следващите клиенти и ще ги вдъхновиш.</p>
    ${buttonCta("Дай ревю", APP_URL + "#/programs")}
    <p style="font-size:13px;color:#999;margin-top:24px"><strong>Какво следва?</strong></p>
    <p style="font-size:13px;color:#999">Запазваш безплатен достъп до hranene/тегло/стъпки трекери. Готов ли си за студио-тренировки на живо? <a href="https://synrg-beyondfitness.com/studio.html" style="color:#c4e9bf">Виж пакетите</a>.</p>
  `),
});

const tmpl_free_d7 = (name: string) => ({
  subject: "Готов ли си за следващото ниво?",
  html: wrap(`${name},`, `
    <p>Седмица откакто си в SYNRG. Видя ли вече SYNRG Метод?</p>
    <p>8-седмична програма с професионален ментор:</p>
    <ul>
      <li>Персонализиран хранителен режим</li>
      <li>2 check-in сесии месечно с ментор</li>
      <li>Тренировъчни планове</li>
      <li>Достъп до общност</li>
    </ul>
    <p><strong>Early Bird цена за първите 100: €127</strong> (вместо €197).</p>
    ${buttonCta("Виж SYNRG Метод", APP_URL + "#/programs")}
  `),
});

const tmpl_free_d14 = (name: string) => ({
  subject: "Last call — Early Bird тече",
  html: wrap(`${name},`, `
    <p>Early Bird цената на SYNRG Метод (€127) е валидна само за първите 100 клиента.</p>
    <p>След това се връща на пълна цена €197.</p>
    <p>Ако се колебаеш — ето защо клиентите ни го избират:</p>
    <ul>
      <li>Не е "още една програма" — има реален човек до теб</li>
      <li>Адаптираме спрямо твоето ниво</li>
      <li>Резултати се виждат от 2-ра седмица</li>
    </ul>
    ${buttonCta("Купи сега", APP_URL + "#/programs")}
  `),
});

const tmpl_inactive_14d = (name: string) => ({
  subject: "Липсваш ни в SYNRG",
  html: wrap(`${name},`, `
    <p>Не си отварял app-а от 2 седмици. Всичко наред ли е?</p>
    <p>Знаем че понякога мотивацията пада. Затова имаме просто предложение:</p>
    <p><strong>Започни с 1 нещо днес.</strong> Само 1.</p>
    <ul>
      <li>Изпии чаша вода</li>
      <li>Логни 1 хранене</li>
      <li>Направи 10 клякания</li>
    </ul>
    <p>Малките стъпки събират прогрес. Чакаме те.</p>
    ${buttonCta("Влез отново", APP_URL)}
  `),
});

// ── Main handler ────────────────────────────────────────────────
async function processBuyerSequence(autoMap: Map<string, AutoRow>): Promise<{ sent: number; checked: number }> {
  const stats = { sent: 0, checked: 0 };
  // Get all active program purchases from last 60 days
  const cutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/program_purchases?select=id,client_id,purchased_at,status&purchased_at=gte.${cutoff}&status=in.(active,expired)`,
    { headers: sbHeaders() }
  );
  const purchases = await res.json() as Array<{ id: string; client_id: string; purchased_at: string; status: string }>;

  for (const p of purchases) {
    stats.checked++;
    const days = Math.floor((Date.now() - new Date(p.purchased_at).getTime()) / (24 * 60 * 60 * 1000));
    let dbKey: string | null = null;
    let sendKey: string | null = null;
    let fallback: ((name: string) => { subject: string; html: string }) | null = null;
    if (days === 1) { dbKey = "buyer_d1"; sendKey = `buyer_d1_${p.id}`; fallback = tmpl_buyer_d1; }
    else if (days === 3) { dbKey = "buyer_d3"; sendKey = `buyer_d3_${p.id}`; fallback = tmpl_buyer_d3; }
    else if (days === 7) { dbKey = "buyer_d7"; sendKey = `buyer_d7_${p.id}`; fallback = tmpl_buyer_d7; }
    else if (days === 14) { dbKey = "buyer_d14"; sendKey = `buyer_d14_${p.id}`; fallback = tmpl_buyer_d14; }
    else if (days === 28) { dbKey = "buyer_d28"; sendKey = `buyer_d28_${p.id}`; fallback = tmpl_buyer_d28; }
    else if (days >= 56 && days <= 60) { dbKey = "buyer_d56_review"; sendKey = `buyer_d56_review_${p.id}`; fallback = tmpl_buyer_d56_review; }
    if (!dbKey || !sendKey || !fallback) continue;

    // Skip early if disabled in DB
    const row = autoMap.get(dbKey);
    if (row && !row.enabled) continue;

    if (await alreadySent(p.client_id, sendKey)) continue;

    // Get client email + name
    const cRes = await fetch(`${SUPABASE_URL}/rest/v1/clients?select=email,name&id=eq.${p.client_id}&limit=1`, { headers: sbHeaders() });
    const c = (await cRes.json())?.[0];
    if (!c?.email) continue;

    const t = resolveTemplate(autoMap, dbKey, c.name || "клиент", fallback);
    if (!t) continue;
    const ok = await sendBrevoEmail({ email: c.email, name: c.name || "клиент" }, t.subject, t.html);
    await logSent(p.client_id, sendKey, ok);
    if (ok) stats.sent++;
  }
  return stats;
}

async function processFreeUserNurture(autoMap: Map<string, AutoRow>): Promise<{ sent: number; checked: number }> {
  const stats = { sent: 0, checked: 0 };
  // Early exit if both freemium templates are disabled — avoids touching any client.
  const d7Row = autoMap.get("free_d7");
  const d14Row = autoMap.get("free_d14");
  if ((d7Row && !d7Row.enabled) && (d14Row && !d14Row.enabled)) return stats;

  // Get clients registered 7-30 days ago who do NOT have any program_purchase
  const cutoff7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const cutoff30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // BUG FIX: studio clients (client_plans) are NOT free users — never upsell them.
  const studioIds = await loadActiveStudioClientIds();

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/clients?select=id,name,email,created_at&created_at=lt.${cutoff7}&created_at=gt.${cutoff30}&is_coach=eq.false`,
    { headers: sbHeaders() }
  );
  const clients = await res.json() as Array<{ id: string; name: string; email: string; created_at: string }>;

  for (const c of clients) {
    if (!c.email) continue;
    stats.checked++;
    // Skip active studio clients (paid in-studio plan)
    if (studioIds.has(c.id)) continue;
    // Skip if has online purchase
    const purch = await fetch(`${SUPABASE_URL}/rest/v1/program_purchases?select=id&client_id=eq.${c.id}&limit=1`, { headers: sbHeaders() });
    const pur = await purch.json();
    if (Array.isArray(pur) && pur.length > 0) continue;

    const days = Math.floor((Date.now() - new Date(c.created_at).getTime()) / (24 * 60 * 60 * 1000));
    let dbKey: string | null = null;
    let sendKey: string | null = null;
    let fallback: ((name: string) => { subject: string; html: string }) | null = null;
    if (days === 7) { dbKey = "free_d7"; sendKey = `free_d7_${c.id}`; fallback = tmpl_free_d7; }
    else if (days === 14) { dbKey = "free_d14"; sendKey = `free_d14_${c.id}`; fallback = tmpl_free_d14; }
    if (!dbKey || !sendKey || !fallback) continue;

    const row = autoMap.get(dbKey);
    if (row && !row.enabled) continue;

    if (await alreadySent(c.id, sendKey)) continue;

    const t = resolveTemplate(autoMap, dbKey, c.name || "клиент", fallback);
    if (!t) continue;
    const ok = await sendBrevoEmail({ email: c.email, name: c.name || "клиент" }, t.subject, t.html);
    await logSent(c.id, sendKey, ok);
    if (ok) stats.sent++;
  }
  return stats;
}

async function processInactiveReengagement(autoMap: Map<string, AutoRow>): Promise<{ sent: number; checked: number }> {
  const stats = { sent: 0, checked: 0 };
  // Early exit if disabled in DB
  const reRow = autoMap.get("inactive_14d");
  if (reRow && !reRow.enabled) return stats;
  // Find clients with no meal/weight log in last 14 days
  const cutoff14 = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  // Get all non-coach clients with email
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/clients?select=id,name,email,created_at&is_coach=eq.false&email=not.is.null`,
    { headers: sbHeaders() }
  );
  const clients = await res.json() as Array<{ id: string; name: string; email: string; created_at: string }>;

  for (const c of clients) {
    if (!c.email) continue;
    stats.checked++;
    // Quick filter: client must be at least 14 days old
    const ageDays = Math.floor((Date.now() - new Date(c.created_at).getTime()) / (24 * 60 * 60 * 1000));
    if (ageDays < 14) continue;
    // Check last meal log
    const mealRes = await fetch(`${SUPABASE_URL}/rest/v1/meals?select=date&client_id=eq.${c.id}&order=date.desc&limit=1`, { headers: sbHeaders() });
    const meals = await mealRes.json();
    const lastMeal = meals?.[0]?.date;
    if (lastMeal && lastMeal >= cutoff14) continue; // logged within 14 days
    // Send re-engagement email at most once per client per 30 days
    const key = `inactive_14d_${new Date().toISOString().slice(0, 7)}_${c.id}`; // monthly key
    if (await alreadySent(c.id, key)) continue;
    const t = resolveTemplate(autoMap, "inactive_14d", c.name || "клиент", tmpl_inactive_14d);
    if (!t) continue;
    const ok = await sendBrevoEmail({ email: c.email, name: c.name || "клиент" }, t.subject, t.html);
    await logSent(c.id, key, ok);
    if (ok) stats.sent++;
  }
  return stats;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  try {
    const autoMap = await loadAutomations();
    const buyer = await processBuyerSequence(autoMap);
    const free = await processFreeUserNurture(autoMap);
    const inactive = await processInactiveReengagement(autoMap);
    return new Response(JSON.stringify({
      success: true,
      buyer,
      free_nurture: free,
      inactive,
      total_sent: buyer.sent + free.sent + inactive.sent,
    }), { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("email-automation error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
