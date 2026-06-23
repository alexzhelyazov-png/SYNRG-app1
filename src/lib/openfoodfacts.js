// Open Food Facts barcode lookup.
// Free, open product database with strong Bulgarian/EU coverage
// (Lidl, Kaufland, Billa and other local brands included).
// Docs: https://openfoodfacts.github.io/openfoodfacts-server/api/

// Look up a product by its barcode (EAN/UPC) and return normalized
// per-100g macros, or null if the product is unknown / has no nutrition data.
export async function lookupBarcode(barcode) {
  const code = String(barcode || '').trim()
  if (!code) return null

  const fields = 'product_name,product_name_bg,generic_name,brands,nutriments,quantity'
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${fields}`

  let json
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    json = await res.json()
  } catch {
    return null
  }

  if (!json || json.status !== 1 || !json.product) return null
  const p = json.product
  const n = p.nutriments || {}

  // Energy: prefer kcal, fall back to converting kJ.
  let kcal = num(n['energy-kcal_100g'])
  if (kcal == null) {
    const kj = num(n['energy_100g']) ?? num(n['energy-kj_100g'])
    if (kj != null) kcal = Math.round(kj / 4.184)
  }
  if (kcal == null) return null  // no usable nutrition data

  const name =
    (p.product_name_bg && p.product_name_bg.trim()) ||
    (p.product_name && p.product_name.trim()) ||
    (p.generic_name && p.generic_name.trim()) ||
    [p.brands, code].filter(Boolean).join(' ').trim() ||
    code

  return {
    barcode: code,
    name,
    brand: (p.brands || '').split(',')[0].trim(),
    kcalPer100:    Math.round(kcal),
    proteinPer100: round1(num(n['proteins_100g'])      ?? 0),
    carbsPer100:   round1(num(n['carbohydrates_100g']) ?? 0),
    fatPer100:     round1(num(n['fat_100g'])           ?? 0),
  }
}

function num(v) {
  if (v == null || v === '') return null
  const x = Number(v)
  return isNaN(x) ? null : x
}

function round1(x) {
  return Math.round(x * 10) / 10
}
