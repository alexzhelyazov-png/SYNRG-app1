/**
 * Supabase Edge Function: AI Food Recognition via Google Gemini Vision
 *
 * Receives a base64-encoded food photo and returns estimated:
 * - Food name (Bulgarian + English)
 * - Estimated grams
 * - Calories and protein per 100g (from nutritional knowledge)
 * - Total calories and protein for the estimated portion
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const { image } = await req.json();
    if (!image) {
      return new Response(
        JSON.stringify({ error: "No image provided" }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
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

TASK: Identify the food in this photo and provide accurate nutritional data.

CRITICAL RULES FOR ACCURACY:
1. For kcalPer100 and proteinPer100: Use standard USDA/nutritional database values, NOT estimates.
   Common reference values:
   - Chicken breast (cooked, no skin): 165 kcal/100g, 31g protein/100g
   - Chicken breast with breading/coating: 200-220 kcal/100g, 25g protein/100g
   - Rice (cooked): 130 kcal/100g, 2.7g protein/100g
   - Pasta (cooked): 131 kcal/100g, 5g protein/100g
   - Egg (boiled): 155 kcal/100g, 13g protein/100g
   - Bread: 265 kcal/100g, 9g protein/100g
   - Banana: 89 kcal/100g, 1.1g protein/100g
   - Apple: 52 kcal/100g, 0.3g protein/100g

2. For portion estimation (grams): Be CONSERVATIVE. People typically overestimate portions.
   - A single chicken breast piece is usually 80-150g, not 200g+
   - A small snack/side portion is 30-60g
   - Use visual cues: plate size (standard dinner plate = 26cm), utensils, hand size
   - When uncertain, estimate LOWER rather than higher

3. Calculate total kcal and protein from: (grams / 100) * per100 values

Return a JSON object with these exact fields:
{
  "name": "Food name in Bulgarian",
  "nameEn": "Food name in English",
  "grams": estimated portion in grams (number, be conservative),
  "kcalPer100": calories per 100g from nutritional database (number),
  "proteinPer100": protein per 100g from nutritional database (number),
  "kcal": total kcal for this portion (number, = grams/100 * kcalPer100),
  "protein": total protein for this portion (number, = grams/100 * proteinPer100)
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
