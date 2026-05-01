/**
 * Supabase Edge Function: Monthly Winners
 *
 * Computes the previous month's monthly-XP top 10 for all non-coach
 * clients and emails the result to admin (info@synrg-beyondfitness.com).
 *
 * Why a dedicated function (instead of adding to daily-reminders):
 *   • Clear separation — can be triggered manually for any past month
 *     by passing { month: "YYYY-MM" } in the body.
 *   • The XP math (collectMonthlyStats + checkMonthlyBadge) is a
 *     verbatim port of src/lib/gamification.js so output matches the
 *     in-app ranking dialog 1:1.
 *
 * IMPORTANT: PostgREST caps each request at 1000 rows. We paginate via
 * Range/offset until exhausted — without this, large tables (4000+
 * meals) silently truncate and totals look low.
 *
 * Cron setup (run on day 1 at 09:00 UTC):
 *   SELECT cron.schedule('monthly-winners', '0 9 1 * *',
 *     $$SELECT net.http_post(
 *       'https://nzrtdqlgljcipfmectwp.supabase.co/functions/v1/monthly-winners',
 *       '{}', '{"Content-Type":"application/json"}'
 *     )$$
 *   );
 *
 * Manual invoke (any month):
 *   curl -X POST <fn-url> -H 'Content-Type: application/json' \
 *        -d '{"month":"2026-04","force":true}'
 *   • `force: true` skips the "is today the 1st?" guard so you can
 *     re-send a past month on demand.
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BREVO_API = "https://api.brevo.com/v3";
const SENDER = { name: "SYNRG Beyond Fitness", email: "info@synrg-beyondfitness.com" };
const ADMIN_TO = { name: "SYNRG Admin", email: "info@synrg-beyondfitness.com" };

// ── Type defs ────────────────────────────────────────────────────────
type Meal     = { client_id: string; date: string; kcal?: number; protein?: number };
type Weight   = { client_id: string; date: string; weight?: number };
type Workout  = { client_id: string; date: string };
type Step     = { client_id: string; date: string; steps?: number };
type Booking  = { client_id: string; slot_id: string; status: string };
type Slot     = { id: string; slot_date: string };
type Post     = { author_name: string; created_at: string };
type Client   = {
  id: string; name: string; email?: string; is_coach?: boolean;
  calorie_target?: number; protein_target?: number;
};

// ── MONTHLY_BADGES (verbatim from gamification.js) ───────────────────
type Badge = {
  id: string; xp: number; condType: string; condField?: string; condValue: number;
};
const MONTHLY_BADGES: Badge[] = [
  { id: 'm_workouts_bronze', xp: 10, condType: 'monthly_count', condField: 'workoutCount', condValue: 8  },
  { id: 'm_workouts_silver', xp: 20, condType: 'monthly_count', condField: 'workoutCount', condValue: 12 },
  { id: 'm_workouts_gold',   xp: 35, condType: 'monthly_count', condField: 'workoutCount', condValue: 16 },
  // m_meals series intentionally removed (founder, 2026-05-01) — see
  // src/lib/gamification.js for the rationale.
  { id: 'm_weights_bronze',  xp: 10, condType: 'monthly_count', condField: 'weightCount',  condValue: 7  },
  { id: 'm_weights_silver',  xp: 20, condType: 'monthly_count', condField: 'weightCount',  condValue: 20 },
  { id: 'm_weights_gold',    xp: 35, condType: 'monthly_count', condField: 'weightCount',  condValue: 30 },
  { id: 'm_streak_bronze',   xp: 10, condType: 'monthly_streak',                            condValue: 7  },
  { id: 'm_streak_silver',   xp: 20, condType: 'monthly_streak',                            condValue: 20 },
  { id: 'm_streak_gold',     xp: 35, condType: 'monthly_streak',                            condValue: 30 },
  { id: 'm_steps_bronze',    xp: 15, condType: 'monthly_steps',                             condValue: 200000 },
  { id: 'm_steps_silver',    xp: 35, condType: 'monthly_steps',                             condValue: 300000 },
  { id: 'm_steps_gold',      xp: 60, condType: 'monthly_steps',                             condValue: 450000 },
  { id: 'm_steps_days_bronze', xp: 10, condType: 'monthly_count', condField: 'stepsDays',   condValue: 7  },
  { id: 'm_steps_days_silver', xp: 20, condType: 'monthly_count', condField: 'stepsDays',   condValue: 15 },
  { id: 'm_steps_days_gold',   xp: 35, condType: 'monthly_count', condField: 'stepsDays',   condValue: 30 },
  { id: 'm_cal_target_bronze', xp: 30, condType: 'monthly_target', condField: 'calTargetDays',  condValue: 7  },
  { id: 'm_cal_target_silver', xp: 50, condType: 'monthly_target', condField: 'calTargetDays',  condValue: 15 },
  { id: 'm_cal_target_gold',   xp: 80, condType: 'monthly_target', condField: 'calTargetDays',  condValue: 30 },
  { id: 'm_prot_target_bronze',xp: 15, condType: 'monthly_target', condField: 'protTargetDays', condValue: 7  },
  { id: 'm_prot_target_silver',xp: 30, condType: 'monthly_target', condField: 'protTargetDays', condValue: 15 },
  { id: 'm_prot_target_gold',  xp: 50, condType: 'monthly_target', condField: 'protTargetDays', condValue: 30 },
  { id: 'm_weight_loss_bronze',xp: 50, condType: 'monthly_weight_loss',                     condValue: 1 },
  { id: 'm_weight_loss_silver',xp: 90, condType: 'monthly_weight_loss',                     condValue: 2 },
  { id: 'm_weight_loss_gold',  xp: 120,condType: 'monthly_weight_loss',                     condValue: 4 },
  { id: 'm_community_bronze',  xp: 10, condType: 'monthly_count', condField: 'communityCount', condValue: 1  },
  { id: 'm_community_silver',  xp: 20, condType: 'monthly_count', condField: 'communityCount', condValue: 5  },
  { id: 'm_community_gold',    xp: 35, condType: 'monthly_count', condField: 'communityCount', condValue: 10 },
];

// ── Helpers (ported from gamification.js) ────────────────────────────
function parseDotDate(d: string): Date {
  const [day, mon, year] = d.split('.').map(Number);
  return new Date(year, mon - 1, day);
}

function longestStreak(dateSet: Set<string>): number {
  if (dateSet.size === 0) return 0;
  const sorted = [...dateSet].map(d => parseDotDate(d).getTime()).sort((a, b) => a - b);
  const unique = [...new Set(sorted)];
  let max = 1, cur = 1;
  for (let i = 1; i < unique.length; i++) {
    const diff = unique[i] - unique[i - 1];
    if (diff <= 86400000 && diff > 0) { cur++; if (cur > max) max = cur; }
    else cur = 1;
  }
  return max;
}

function targetDaysCount(meals: Meal[], target: number, field: 'kcal' | 'protein'): number {
  const byDate: Record<string, number> = {};
  for (const m of meals) {
    byDate[m.date] = (byDate[m.date] || 0) + Number((m as any)[field] || 0);
  }
  return Object.values(byDate).filter(v => v >= target).length;
}

type MonthlyStats = {
  workoutCount: number; mealCount: number; weightCount: number; stepsDays: number;
  totalSteps: number; streak: number; calTargetDays: number; protTargetDays: number;
  monthWeightLoss: number; communityCount: number;
};

function collectMonthlyStats(client: {
  meals: Meal[]; weights: Weight[]; workouts: Workout[]; steps: Step[];
  bookedSessions: { date: string }[]; communityPosts: Post[]; communityComments: Post[];
  calorieTarget: number; proteinTarget: number;
}, monthKey: string): MonthlyStats {
  const [year, month] = monthKey.split('-');
  const matchMonth = (d: string | undefined) => {
    if (!d) return false;
    const parts = d.split('.');
    return parts.length === 3 && parts[1] === month && parts[2] === year;
  };
  const matchISO = (iso: string | undefined) => (iso || '').substring(0, 7) === monthKey;

  const meals    = client.meals.filter(m => matchMonth(m.date));
  const weights  = client.weights.filter(w => matchMonth(w.date));
  const workouts = client.workouts.filter(w => matchMonth(w.date));
  const steps    = client.steps.filter(s => matchMonth(s.date));
  const booked   = client.bookedSessions.filter(s => matchMonth(s.date));

  const communityCount =
    client.communityPosts.filter(p => matchISO(p.created_at)).length +
    client.communityComments.filter(c => matchISO(c.created_at)).length;

  const stepsDateSet = new Set(steps.map(s => s.date));
  const workoutDateSet = new Set([...workouts.map(w => w.date), ...booked.map(s => s.date)]);
  const allDateSet = new Set<string>([
    ...meals.map(m => m.date),
    ...weights.map(w => w.date),
    ...workoutDateSet,
    ...stepsDateSet,
  ]);

  const totalSteps = steps.reduce((sum, s) => sum + Number(s.steps || 0), 0);
  const streak     = longestStreak(allDateSet);

  const calTargetDays  = targetDaysCount(meals, client.calorieTarget || 99999, 'kcal');
  const protTargetDays = targetDaysCount(meals, client.proteinTarget || 99999, 'protein');

  // Averaged weight loss — see gamification.js for the rationale.
  // 4-day rolling window each end, min 2-per-side (so ≥4 logs needed).
  const sortedW = [...weights].sort((a, b) => a.date.localeCompare(b.date));
  const avgW = (arr: Weight[]) => arr.length === 0
    ? 0
    : arr.reduce((s, w) => s + Number(w.weight || 0), 0) / arr.length;
  const winSize = Math.min(4, Math.floor(sortedW.length / 2));
  const monthWeightLoss = winSize >= 2
    ? avgW(sortedW.slice(0, winSize)) - avgW(sortedW.slice(-winSize))
    : 0;

  return {
    workoutCount: workoutDateSet.size,
    mealCount:    meals.length,
    weightCount:  weights.length,
    stepsDays:    stepsDateSet.size,
    totalSteps,
    streak,
    calTargetDays,
    protTargetDays,
    monthWeightLoss: Math.max(0, monthWeightLoss),
    communityCount,
  };
}

function checkMonthlyBadge(badge: Badge, stats: MonthlyStats): boolean {
  switch (badge.condType) {
    case 'monthly_count':       return ((stats as any)[badge.condField!] || 0) >= badge.condValue;
    case 'monthly_streak':      return stats.streak >= badge.condValue;
    case 'monthly_steps':       return stats.totalSteps >= badge.condValue;
    case 'monthly_target':      return ((stats as any)[badge.condField!] || 0) >= badge.condValue;
    case 'monthly_weight_loss': return stats.monthWeightLoss >= badge.condValue;
    default: return false;
  }
}

function evaluateMonthlyXP(client: any, monthKey: string): { xp: number; badgeCount: number } {
  const stats = collectMonthlyStats(client, monthKey);
  let xp = 0, count = 0;
  for (const b of MONTHLY_BADGES) {
    if (checkMonthlyBadge(b, stats)) { xp += b.xp; count++; }
  }
  return { xp, badgeCount: count };
}

// ── Paginated PostgREST fetch (handles >1000 rows) ───────────────────
async function fetchAll<T>(
  baseUrl: string, table: string, select: string, headers: Record<string, string>,
): Promise<T[]> {
  const out: T[] = [];
  let offset = 0;
  while (true) {
    const url = `${baseUrl}/rest/v1/${table}?select=${select}&offset=${offset}&limit=1000`;
    const r = await fetch(url, { headers });
    const data = await r.json();
    if (!Array.isArray(data) || data.length === 0) break;
    out.push(...data);
    if (data.length < 1000) break;
    offset += 1000;
  }
  return out;
}

// ── Email rendering ──────────────────────────────────────────────────
function renderEmailHtml(monthLabel: string, top: { rank: number; name: string; xp: number; badges: number }[]): string {
  const podium = top.slice(0, 3);
  const rest   = top.slice(3);
  const podiumHtml = `
    <div style="display:flex;gap:8px;margin:24px 0">
      ${podium.map((p, i) => `
        <div style="flex:1;text-align:center;padding:18px 8px;border-radius:12px;
                    background:${i===0?'rgba(212,175,55,0.10)':i===1?'rgba(148,163,184,0.10)':'rgba(205,127,50,0.10)'};
                    border:1px solid ${i===0?'#D4AF37':i===1?'#94A3B8':'#CD7F32'}">
          <div style="font-size:28px;font-weight:900;color:${i===0?'#D4AF37':i===1?'#CBD5E1':'#CD7F32'}">
            ${p.rank}
          </div>
          <div style="font-size:13px;font-weight:700;line-height:1.2;min-height:32px;color:#fff">
            ${p.name}
          </div>
          <div style="font-size:20px;font-weight:800;margin-top:8px;color:${i===0?'#D4AF37':i===1?'#CBD5E1':'#CD7F32'}">
            ${p.xp} XP
          </div>
        </div>
      `).join('')}
    </div>`;
  const rowsHtml = top.map(d => `
    <tr style="border-bottom:1px solid rgba(255,255,255,0.05)">
      <td style="padding:10px 8px;color:rgba(196,209,205,0.7);font-weight:700;width:36px">${d.rank}</td>
      <td style="padding:10px 8px;color:#fff;font-weight:600">${d.name}</td>
      <td style="padding:10px 8px;color:rgba(196,209,205,0.55);font-size:11px">${d.badges} значки</td>
      <td style="padding:10px 8px;color:#C4E9BF;font-weight:800;text-align:right">${d.xp} XP</td>
    </tr>
  `).join('');
  return `
    <div style="font-family:-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:32px;background:#151816;color:#fff;border-radius:16px;border:1px solid rgba(170,169,205,0.26)">
      <p style="font-size:13px;letter-spacing:2px;color:#C4E9BF;font-weight:700;margin:0 0 4px">SYNRG · МЕСЕЧНА КЛАСАЦИЯ</p>
      <h1 style="font-size:32px;font-style:italic;font-weight:800;margin:0 0 6px">${monthLabel}</h1>
      <p style="font-size:13px;color:rgba(196,209,205,0.7);margin:0 0 8px">Финални точки · топ 10</p>
      ${podiumHtml}
      <table style="width:100%;border-collapse:collapse;margin-top:12px">${rowsHtml}</table>
      <p style="margin-top:20px;font-size:11px;color:rgba(196,209,205,0.4);text-align:center;line-height:1.5">
        Изчислено от месечните badges · SYNRG Beyond Fitness
      </p>
    </div>`;
}

async function sendEmail(brevoKey: string, subject: string, html: string) {
  const res = await fetch(`${BREVO_API}/smtp/email`, {
    method: "POST",
    headers: { "api-key": brevoKey, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ sender: SENDER, to: [ADMIN_TO], subject, htmlContent: html }),
  });
  if (!res.ok) throw new Error(`Brevo ${res.status}: ${await res.text()}`);
}

// ── Main handler ─────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const brevoKey    = Deno.env.get("BREVO_API_KEY")!;
    const sbHeaders   = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };

    // Parse body — { month?: 'YYYY-MM', force?: boolean }
    let body: any = {};
    try { body = await req.json(); } catch { /* empty body OK */ }

    // Default to PREVIOUS month (the cron runs on day 1 → we want last month)
    const now = new Date();
    let targetMonth: string;
    if (body.month) {
      targetMonth = body.month;
    } else {
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      targetMonth = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
    }

    // Day-1 guard — the cron hits us daily but we only want to fire on the 1st.
    // `force: true` (or explicit `month`) bypasses the guard for ad-hoc runs.
    if (!body.force && !body.month && now.getDate() !== 1) {
      return new Response(JSON.stringify({
        skipped: true,
        reason: `Today is day ${now.getDate()}, monthly winners only fire on day 1.`,
      }), { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
    }

    // ── 1. Pull all relevant data (paginated to bypass 1000-row cap) ──
    const [clients, workouts, meals, weights, steps, posts, comments, slots, bookings] =
      await Promise.all([
        fetchAll<Client>(supabaseUrl,  'clients',         'id,name,email,is_coach,calorie_target,protein_target', sbHeaders),
        fetchAll<Workout>(supabaseUrl, 'workouts',        'client_id,date',                    sbHeaders),
        fetchAll<Meal>(supabaseUrl,    'meals',           'client_id,date,kcal,protein',       sbHeaders),
        fetchAll<Weight>(supabaseUrl,  'weight_logs',     'client_id,date,weight',             sbHeaders),
        fetchAll<Step>(supabaseUrl,    'steps_logs',      'client_id,date,steps',              sbHeaders),
        fetchAll<Post>(supabaseUrl,    'community_posts', 'author_name,created_at',            sbHeaders),
        fetchAll<Post>(supabaseUrl,    'post_comments',   'author_name,created_at',            sbHeaders).catch(() => []),
        fetchAll<Slot>(supabaseUrl,    'booking_slots',   'id,slot_date',                      sbHeaders).catch(() => []),
        fetchAll<Booking>(supabaseUrl, 'slot_bookings',   'client_id,slot_id,status',          sbHeaders).catch(() => []),
      ]);

    // Convert booking slot dates ISO → DD.MM.YYYY (collectMonthlyStats expects dot format)
    const slotById: Record<string, string> = {};
    for (const s of slots) {
      const [y, m, d] = (s.slot_date || '').split('-');
      if (y) slotById[s.id] = `${d}.${m}.${y}`;
    }
    const sessionsByClient: Record<string, { date: string }[]> = {};
    for (const b of bookings) {
      if (b.status !== 'active' && b.status !== 'completed') continue;
      const date = slotById[b.slot_id];
      if (!date) continue;
      (sessionsByClient[b.client_id] = sessionsByClient[b.client_id] || []).push({ date });
    }

    // ── 2. Compute monthly XP for each non-coach client ──
    const ranked = clients.filter(c => !c.is_coach).map(c => {
      const enriched = {
        meals:    meals.filter(m => m.client_id === c.id),
        weights:  weights.filter(w => w.client_id === c.id),
        workouts: workouts.filter(w => w.client_id === c.id),
        steps:    steps.filter(s => s.client_id === c.id),
        bookedSessions: sessionsByClient[c.id] || [],
        communityPosts:    posts.filter(p => p.author_name === c.name),
        communityComments: comments.filter(cm => cm.author_name === c.name),
        calorieTarget: c.calorie_target || 0,
        proteinTarget: c.protein_target || 0,
      };
      const { xp, badgeCount } = evaluateMonthlyXP(enriched, targetMonth);
      return { name: c.name, xp, badges: badgeCount };
    })
    .filter(r => r.xp > 0)
    .sort((a, b) => b.xp - a.xp)
    .slice(0, 10)
    .map((r, i) => ({ rank: i + 1, ...r }));

    // ── 3. Email admin ──
    const monthLabel = (() => {
      const [y, m] = targetMonth.split('-');
      const names = ['Януари','Февруари','Март','Април','Май','Юни','Юли','Август','Септември','Октомври','Ноември','Декември'];
      return `${names[Number(m) - 1]} ${y}`;
    })();
    if (ranked.length === 0) {
      return new Response(JSON.stringify({ month: targetMonth, sent: false, reason: 'No clients with XP > 0' }),
        { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
    }

    // ── 4. Upsert snapshot into monthly_winners ──
    // The Ranking page reads this row to display "Победител за <month>:"
    // banner. Upsert (not insert) so manual `force: true` re-runs
    // overwrite the row instead of failing.
    const winner = ranked[0];
    const upsertRes = await fetch(
      `${supabaseUrl}/rest/v1/monthly_winners?on_conflict=month_key`,
      {
        method: 'POST',
        headers: { ...sbHeaders, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({
          month_key:   targetMonth,
          winner_name: winner.name,
          winner_xp:   winner.xp,
          top10:       ranked,
        }),
      }
    );
    if (!upsertRes.ok) {
      console.error('monthly_winners upsert failed:', upsertRes.status, await upsertRes.text());
    }

    // ── 5. Email admin ──
    const html = renderEmailHtml(monthLabel, ranked);
    await sendEmail(brevoKey, `Месечна класация — ${monthLabel}`, html);

    return new Response(JSON.stringify({
      success: true, month: targetMonth, monthLabel,
      sent_to: ADMIN_TO.email, top: ranked,
    }), { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("monthly-winners error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
