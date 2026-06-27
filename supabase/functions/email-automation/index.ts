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
  // Only record SUCCESSFUL sends. A failed send leaves no row, so the next
  // hourly run retries it (alreadySent is an existence check).
  if (!success) return;
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

// Clients who have logged anything (meals or weight) — used to pick the day-1 variant.
async function loadActivityClientIds(): Promise<Set<string>> {
  const s = new Set<string>();
  try {
    const [mRes, wRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/meals?select=client_id`, { headers: sbHeaders() }),
      fetch(`${SUPABASE_URL}/rest/v1/weight_logs?select=client_id`, { headers: sbHeaders() }),
    ]);
    const meals = await mRes.json();
    const weights = await wRes.json();
    if (Array.isArray(meals)) for (const m of meals) s.add(m.client_id);
    if (Array.isArray(weights)) for (const w of weights) s.add(w.client_id);
  } catch (e) { console.error("loadActivityClientIds failed:", e); }
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

// Freemium funnel — value sequence (day 1 active/inactive, day 3 protein).
const tmpl_free_d1_active = (_name: string) => ({
  subject: "Браво за старта! Ето как да си зададеш калориите",
  html: chrome(`<h2 style="color:#c4e9bf;margin:0 0 16px;font-size:22px">Браво за старта!</h2>
  <p style="margin:0 0 16px">Радваме се, че започна да използваш приложението — за нас това значи много.</p>
  <p style="margin:0 0 16px">Видяхме, че вече въвеждаш данни — браво, това е най-трудната първа крачка. Сега да направим следенето ти смислено.</p>
  <h3 style="color:#c4e9bf;margin:24px 0 8px;font-size:17px">Зададе ли си калорийните таргети?</h3>
  <p style="margin:0 0 12px">Ако още не си, ето формула да си ги сметнеш спрямо целта:</p>
  <p style="margin:0 0 10px"><strong>1. Базов метаболизъм (BMR):</strong><br>Жени: 10 × тегло(кг) + 6.25 × ръст(см) − 5 × възраст − 161<br>Мъже: 10 × тегло(кг) + 6.25 × ръст(см) − 5 × възраст + 5</p>
  <p style="margin:0 0 10px"><strong>2. Умножи по активността:</strong><br>Заседнал × 1.2 · Лека (1–3 трен./седм.) × 1.375 · Умерена (3–5) × 1.55</p>
  <p style="margin:0 0 10px"><strong>3. Спрямо целта:</strong><br>Сваляне − 20% · Поддържане без промяна · Качване + 10%</p>
  <p style="margin:0 0 16px">Получената цифра въведи в <strong>Хранене → таргети</strong>. Пример: жена 70кг, 165см, 30г, лека активност, сваляне → ≈ <strong>1580 ккал/ден</strong>.</p>
  <h3 style="color:#c4e9bf;margin:24px 0 8px;font-size:17px">И теглото</h3>
  <p style="margin:0 0 12px">Знаеш как теглото се променя ден за ден — може и с 1–2 кг. Това е вода. Измервай се всяка сутрин на гладно и го въвеждай: приложението изглажда колебанията и ти показва <strong>реалното</strong> тегло, а след 3–4 измервания ти дава <strong>графика с колко кг на седмица</strong> реално се променяш.</p>
  ${buttonCta("Отвори приложението", APP_URL)}`),
});

const tmpl_free_d1_inactive = (_name: string) => ({
  subject: "Първата стъпка в SYNRG — твоите калории",
  html: chrome(`<h2 style="color:#c4e9bf;margin:0 0 16px;font-size:22px">Добре дошъл в SYNRG</h2>
  <p style="margin:0 0 16px">Радваме се, че се присъедини към приложението — за нас това значи много.</p>
  <p style="margin:0 0 16px">Видяхме, че още не си въвел нищо — напълно нормално е, началото винаги е най-неясната част. Ако нещо те затруднява или не знаеш откъде да започнеш, просто отговори на този имейл и ще ти помогнем лично.</p>
  <h3 style="color:#c4e9bf;margin:24px 0 8px;font-size:17px">Първата стъпка: калориите</h3>
  <p style="margin:0 0 12px">Сметни си дневните калории спрямо целта:</p>
  <p style="margin:0 0 10px"><strong>1. Базов метаболизъм (BMR):</strong><br>Жени: 10 × тегло(кг) + 6.25 × ръст(см) − 5 × възраст − 161<br>Мъже: 10 × тегло(кг) + 6.25 × ръст(см) − 5 × възраст + 5</p>
  <p style="margin:0 0 10px"><strong>2. Умножи по активността:</strong><br>Заседнал × 1.2 · Лека (1–3 трен./седм.) × 1.375 · Умерена (3–5) × 1.55</p>
  <p style="margin:0 0 10px"><strong>3. Спрямо целта:</strong><br>Сваляне − 20% · Поддържане без промяна · Качване + 10%</p>
  <p style="margin:0 0 16px">Въведи числото в <strong>Хранене → таргети</strong>. Оттам само търсиш храната, която ще хапнеш, и въвеждаш грамажа — приложението смята калориите вместо теб.</p>
  <h3 style="color:#c4e9bf;margin:24px 0 8px;font-size:17px">И теглото</h3>
  <p style="margin:0 0 12px">Знаеш как теглото се променя ден за ден — може и с 1–2 кг. Това е вода. Измервай се всяка сутрин на гладно и го въвеждай: приложението изглажда колебанията и ти показва <strong>реалното</strong> тегло, а след 3–4 измервания ти дава <strong>графика с колко кг на седмица</strong> реално се променяш.</p>
  ${buttonCta("Започни сега", APP_URL)}`),
});

const tmpl_free_d3_active = (_name: string) => ({
  subject: "Ден 3: да добавим и протеина",
  html: chrome(`<h2 style="color:#c4e9bf;margin:0 0 16px;font-size:22px">Сега да добавим протеина</h2>
  <p style="margin:0 0 16px">Аз съм д-р Желязова, гастроентеролог и един от хората зад SYNRG Метод. Искам лично да ти кажа за следващата важна стъпка.</p>
  <p style="margin:0 0 16px">Браво — вече следиш калориите. Нека добавим и протеина, защото той е макронутриентът, който решава <strong>как</strong> ще изглеждаш на финала, не само колко тежиш.</p>
  <h3 style="color:#c4e9bf;margin:24px 0 8px;font-size:17px">Защо е важен</h3>
  <p style="margin:0 0 16px">Протеинът е основният макронутриент, отговарящ за регенерирането и цялостното възстановяване. Докато сваляш килограми, достатъчно протеин пази мускула — така тялото изглежда <strong>стегнато</strong>, а не отпуснато.</p>
  <h3 style="color:#c4e9bf;margin:24px 0 8px;font-size:17px">Твоят дневен таргет</h3>
  <p style="margin:0 0 10px"><strong>Ако тренираш:</strong> тегло(кг) × 2 = грама протеин на ден.<br><strong>Ако не тренираш:</strong> тегло(кг) × 1.5 = грама протеин на ден.</p>
  <p style="margin:0 0 16px">Пример: 70 кг и тренираш → ≈ <strong>140 г протеин/ден</strong>.</p>
  <p style="margin:0 0 16px">Въведи числото в <strong>Хранене → таргети</strong>, до калориите. Приложението ще ти показва колко протеин събираш всеки ден, докато търсиш храната и въвеждаш грамажа.</p>
  ${buttonCta("Отвори приложението", APP_URL)}
  <p style="margin:16px 0 0;font-size:14px;color:#9bbf97">— Д-р Желязова · SYNRG Метод</p>`),
});

const tmpl_free_d3_inactive = (_name: string) => ({
  subject: "Опитай само една седмица — д-р Желязова",
  html: chrome(`<h2 style="color:#c4e9bf;margin:0 0 16px;font-size:22px">Опитай само една седмица</h2>
  <p style="margin:0 0 16px">Аз съм д-р Желязова от SYNRG. Искам да ти кажа нещо лично.</p>
  <p style="margin:0 0 16px">Да следиш калориите си за 1–2 седмици е нещо, което бих препоръчала на всеки. Не защото трябва да го правиш с години — за нормалния човек това не е устойчиво. А защото за тази седмица ще разбереш изключително много за навици, които си изграждал с години.</p>
  <p style="margin:0 0 16px">Ще научиш как изглеждат 100 г от различни храни и кои са най-калоричните точно при теб. Това е старт, който носи яснота.</p>
  <p style="margin:0 0 16px">Затова — опитай само седмица. Просто търсиш храната, която хапваш, и въвеждаш грамажа; приложението смята вместо теб.</p>
  <p style="margin:0 0 16px">Едно действие днес е по-важно от перфектен план утре. А ако нещо те спира — просто отговори на този имейл и ще ти помогнем лично.</p>
  ${buttonCta("Започни днес", APP_URL)}
  <p style="margin:16px 0 0;font-size:14px;color:#9bbf97">— Д-р Желязова · SYNRG Метод</p>`),
});

// ── Main handler ────────────────────────────────────────────────
async function processBuyerSequence(autoMap: Map<string, AutoRow>): Promise<{ sent: number; checked: number; failed: number }> {
  const stats = { sent: 0, checked: 0, failed: 0 };
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
    if (ok) stats.sent++; else stats.failed++;
  }
  return stats;
}

async function processFreeUserNurture(autoMap: Map<string, AutoRow>): Promise<{ sent: number; checked: number; failed: number }> {
  const stats = { sent: 0, checked: 0, failed: 0 };
  // Early exit only if EVERY freemium nurture template is disabled (missing row => fallback active).
  const freeKeys = ["free_d1_active", "free_d1_inactive", "free_d3_active", "free_d3_inactive"];
  const anyEnabled = freeKeys.some((k) => { const r = autoMap.get(k); return !r || r.enabled; });
  if (!anyEnabled) return stats;

  // Window: clients registered between 1 and 31 days ago (covers day 1 and 3).
  const cutoff1 = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
  const cutoff31 = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();

  // BUG FIX: studio clients (client_plans) are NOT free users — never upsell them.
  const studioIds = await loadActiveStudioClientIds();
  // Activity split for the day-1 variant (logged something vs nothing).
  const activeIds = await loadActivityClientIds();

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/clients?select=id,name,email,created_at&created_at=lt.${cutoff1}&created_at=gt.${cutoff31}&is_coach=eq.false`,
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
    let fallback: ((name: string) => { subject: string; html: string }) | null = null;
    let siblingKey: string | null = null; // the other activity variant for the same stage
    if (days === 1) {
      if (activeIds.has(c.id)) { dbKey = "free_d1_active"; fallback = tmpl_free_d1_active; siblingKey = "free_d1_inactive"; }
      else { dbKey = "free_d1_inactive"; fallback = tmpl_free_d1_inactive; siblingKey = "free_d1_active"; }
    } else if (days === 3) {
      if (activeIds.has(c.id)) { dbKey = "free_d3_active"; fallback = tmpl_free_d3_active; siblingKey = "free_d3_inactive"; }
      else { dbKey = "free_d3_inactive"; fallback = tmpl_free_d3_inactive; siblingKey = "free_d3_active"; }
    }
    if (!dbKey || !fallback) continue;
    const sendKey = `${dbKey}_${c.id}`;

    const row = autoMap.get(dbKey);
    if (row && !row.enabled) continue;

    if (await alreadySent(c.id, sendKey)) continue;
    // If activity flipped mid-window and the sibling variant already went out, don't double-send this stage.
    if (siblingKey && await alreadySent(c.id, `${siblingKey}_${c.id}`)) continue;

    const t = resolveTemplate(autoMap, dbKey, c.name || "клиент", fallback);
    if (!t) continue;
    const ok = await sendBrevoEmail({ email: c.email, name: c.name || "клиент" }, t.subject, t.html);
    await logSent(c.id, sendKey, ok);
    if (ok) stats.sent++; else stats.failed++;
  }
  return stats;
}

async function processInactiveReengagement(autoMap: Map<string, AutoRow>): Promise<{ sent: number; checked: number; failed: number }> {
  const stats = { sent: 0, checked: 0, failed: 0 };
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
    if (ok) stats.sent++; else stats.failed++;
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
    const totalFailed = buyer.failed + free.failed + inactive.failed;
    // Health alert: if any send failed (e.g. Brevo throttling/outage), email the admin
    // so silent failures never go unnoticed. Failed sends are not logged, so they retry next run.
    if (totalFailed > 0) {
      await sendBrevoEmail(
        { email: "info@synrg-beyondfitness.com", name: "SYNRG" },
        `⚠️ Email automation: ${totalFailed} провалени изпращания`,
        `<p>Часовият ран на email-automation е имал провали (ще се пробват пак следващия час):</p>
         <ul>
           <li>Buyer: ${buyer.sent} пратени / ${buyer.failed} провалени (от ${buyer.checked})</li>
           <li>Freemium: ${free.sent} пратени / ${free.failed} провалени (от ${free.checked})</li>
           <li>Inactive: ${inactive.sent} пратени / ${inactive.failed} провалени (от ${inactive.checked})</li>
         </ul>
         <p>Ако се повтаря — провери Brevo лимита/статус.</p>`
      );
    }
    return new Response(JSON.stringify({
      success: true,
      buyer,
      free_nurture: free,
      inactive,
      total_sent: buyer.sent + free.sent + inactive.sent,
      total_failed: totalFailed,
    }), { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("email-automation error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
