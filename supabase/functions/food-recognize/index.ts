/**
 * Supabase Edge Function: AI Food Recognition via Google Gemini Vision
 *
 * Receives a base64-encoded food photo and returns estimated:
 * - Food name (Bulgarian + English)
 * - Estimated grams
 * - Calories and protein per 100g (from nutritional knowledge)
 * - Total calories and protein for the estimated portion
 */

const ALLOWED_ORIGINS = [
  "https://synrg-beyondfitness.com",
  "https://aleksandarzhelyazov.github.io",
  "http://localhost:5173",
  "http://localhost:3000",
];
function corsHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

// Daily quota per client. Prevents bot abuse / accidental spam = cost overrun.
const DAILY_QUOTA = 30;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function checkAndIncrementQuota(clientId: string): Promise<{ allowed: boolean; count: number }> {
  const today = new Date().toISOString().slice(0, 10);
  // Atomic upsert + increment via PostgREST
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/incr_food_quota`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_client_id: clientId, p_date: today }),
  });
  if (!res.ok) {
    console.warn("Quota check failed (allowing through):", await res.text());
    return { allowed: true, count: 0 };
  }
  const newCount = await res.json();
  return { allowed: newCount <= DAILY_QUOTA, count: newCount };
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const cors = corsHeaders(origin);
  const CORS_HEADERS = cors;

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const { image, client_id } = await req.json();
    if (!image) {
      return new Response(
        JSON.stringify({ error: "No image provided" }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // Quota enforcement (graceful — allow if no client_id for backward compat, log it)
    if (client_id) {
      const quota = await checkAndIncrementQuota(client_id);
      if (!quota.allowed) {
        return new Response(
          JSON.stringify({
            error: "quota_exceeded",
            message: `Дневният лимит за разпознаване на храна (${DAILY_QUOTA}) е достигнат. Опитай отново утре.`,
            count: quota.count,
            limit: DAILY_QUOTA,
          }),
          { status: 429, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
        );
      }
    } else {
      console.warn("food-recognize called without client_id");
    }

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "GEMINI_API_KEY not configured" }),
        { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // Strip data URI prefix if present
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");

    const prompt = `You are a certified sports nutritionist with expertise in food portion estimation.
This app is used by fitness clients who typically eat HEALTHY, home-cooked meals.

TASK: Identify the food in this photo and provide accurate nutritional data.

CRITICAL RULES FOR ACCURACY:

1. COOKING METHOD — NEVER assume food is deep-fried or fried unless you clearly see:
   - Oil bubbles, deep golden crust, or a deep fryer
   - A frying pan with visible oil
   If food has a coating/breading but is on a baking tray or plate, assume it is OVEN-BAKED.
   Baked chicken with cornflakes/breadcrumb coating: 170-185 kcal/100g (NOT 250 kcal like fried).
   Default to the healthiest reasonable cooking method (baked > grilled > pan-fried > deep-fried).

2. DRINKS — Pay close attention to labels, branding and variants:
   - If you see "Zero", "Light", "Diet", "Sugar Free" or "0 kcal" on a bottle/can, it is the ZERO variant.
   - Coca-Cola Zero / Pepsi Max / any "Zero" drink: 0-1 kcal/100ml, 0g protein
   - Regular Coca-Cola: 42 kcal/100ml
   - ALWAYS read the label on the packaging. Do NOT default to the regular version.

3. For kcalPer100 and proteinPer100: Use standard USDA/nutritional database values, NOT estimates.
   Common reference values:
   - Chicken breast (baked, no skin): 165 kcal/100g, 31g protein/100g
   - Chicken breast with baked coating: 170-185 kcal/100g, 28g protein/100g
   - Chicken breast deep-fried: 220-250 kcal/100g, 24g protein/100g
   - Rice (cooked): 130 kcal/100g, 2.7g protein/100g
   - Pasta (cooked): 131 kcal/100g, 5g protein/100g
   - Egg (boiled): 155 kcal/100g, 13g protein/100g
   - Bread: 265 kcal/100g, 9g protein/100g
   - Banana: 89 kcal/100g, 1.1g protein/100g
   - Apple: 52 kcal/100g, 0.3g protein/100g
   - Oats (dry): 389 kcal/100g, 17g protein/100g
   - Greek yogurt (2%): 73 kcal/100g, 10g protein/100g
   - Cottage cheese: 98 kcal/100g, 11g protein/100g

4. For portion estimation (grams): Be CONSERVATIVE. People typically overestimate portions.
   - A single chicken breast piece is usually 80-150g, not 200g+
   - A small snack/side portion is 30-60g
   - For drinks: read bottle/can size if visible (330ml can, 500ml bottle, etc.)
   - Use visual cues: plate size (standard dinner plate = 26cm), utensils, hand size
   - When uncertain, estimate LOWER rather than higher

5. Calculate total kcal and protein from: (grams / 100) * per100 values

6. AMBIGUOUS COOKING METHOD — If the food has a coating, breading, or crust and you cannot tell
   from the photo whether it is baked or fried, include a "cookingOptions" array so the user can choose.
   When cookingOptions is present, use the BAKED values as default for the main fields.

Return a JSON object with these exact fields:
{
  "name": "Food name in Bulgarian (include cooking method and variant, e.g. 'Пилешко филе на фурна с корнфлейкс' not just 'Пържено пиле', or 'Кока-Кола Зиро' not just 'Кока-Кола')",
  "nameEn": "Food name in English (include cooking method and variant)",
  "grams": estimated portion in grams (number, be conservative),
  "kcalPer100": calories per 100g from nutritional database (number),
  "proteinPer100": protein per 100g from nutritional database (number),
  "kcal": total kcal for this portion (number, = grams/100 * kcalPer100),
  "protein": total protein for this portion (number, = grams/100 * proteinPer100),
  "cookingOptions": [OPTIONAL, only if cooking method is ambiguous] [
    {"label": "На фурна", "labelEn": "Baked", "kcalPer100": number, "proteinPer100": number},
    {"label": "Пържено", "labelEn": "Fried", "kcalPer100": number, "proteinPer100": number}
  ]
}

If multiple foods visible, identify the MAIN food item only.
If you cannot identify the food, return: {"error": "unknown"}`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const geminiRes = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: "image/jpeg", data: base64Data } },
          ],
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 500,
          responseMimeType: "application/json",
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error("Gemini API error:", errText);
      return new Response(
        JSON.stringify({ error: "AI service error" }),
        { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const geminiData = await geminiRes.json();
    const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return new Response(
        JSON.stringify({ error: "Could not parse AI response" }),
        { status: 422, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const result = JSON.parse(jsonMatch[0]);

    if (result.error) {
      return new Response(
        JSON.stringify({ error: "unknown" }),
        { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // Sanity check: recalculate totals from per-100g values to ensure consistency
    if (result.grams && result.kcalPer100) {
      result.kcal = Math.round((result.grams / 100) * result.kcalPer100);
    }
    if (result.grams && result.proteinPer100) {
      result.protein = Math.round((result.grams / 100) * result.proteinPer100 * 10) / 10;
    }

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("food-recognize error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
});
