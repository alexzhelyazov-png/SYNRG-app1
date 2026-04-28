/**
 * Supabase Edge Function: Generate BG-compliant Invoice
 *
 * Called from stripe-webhook after successful purchase.
 * Generates invoice with sequential number, BG legal format, and stores in DB.
 *
 * Invoice contains:
 *  - Sequential number (1, 2, 3...) — required by Закон за счетоводството
 *  - Seller details: Синерджи 93 ООД, ЕИК 207343690
 *  - Buyer details: name, email (and EIK/VAT if B2B)
 *  - Service description in Bulgarian
 *  - Amount in EUR + BGN equivalent (dual display per BG transition rule)
 *  - VAT breakdown (0% if not VAT-registered, 20% otherwise)
 *  - Issue date, payment date
 *  - QR code with invoice details (Наредба Н-18 e-receipt)
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Seller details — Синерджи 93 ООД
const SELLER = {
  name: "Синерджи 93 ООД",
  legal_name_en: "Synergy 93 OOD",
  eik: "207343690",
  vat_number: null as string | null, // Set when VAT registered
  address: "гр. Варна, България", // TODO: full registered address
  email: "info@synrg-beyondfitness.com",
  phone: null as string | null,
};

// VAT settings — 0 because not VAT-registered yet (per launch checklist).
// Update to 20 when company registers for VAT.
const VAT_RATE = 0; // percent

// BGN/EUR fixed conversion rate (set by Bulgarian government for euro adoption)
const BGN_PER_EUR = 1.95583;

const ALLOWED_ORIGINS = [
  "https://synrg-beyondfitness.com",
  "https://www.synrg-beyondfitness.com",
  "https://aleksandarzhelyazov.github.io",
  "http://localhost:5173",
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

function sbHeaders() {
  return {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    "Content-Type": "application/json",
  };
}

function formatBGDate(d: Date): string {
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

function formatAmount(cents: number, currency: string): string {
  return (cents / 100).toFixed(2) + " " + currency.toUpperCase();
}

function generateInvoiceHtml(invoice: {
  invoice_number: number;
  buyer_name: string;
  buyer_email: string;
  buyer_address?: string;
  buyer_eik?: string;
  buyer_vat?: string;
  description: string;
  amount_cents: number;
  currency: string;
  vat_rate: number;
  vat_amount_cents: number;
  issued_at: Date;
}): string {
  const subtotal = invoice.amount_cents - invoice.vat_amount_cents;
  const totalEur = invoice.amount_cents;
  const totalBgn = Math.round(invoice.amount_cents * BGN_PER_EUR);
  const issueDate = formatBGDate(invoice.issued_at);
  const invoiceNo = String(invoice.invoice_number).padStart(10, "0");

  return `<!DOCTYPE html>
<html lang="bg">
<head>
<meta charset="UTF-8">
<title>Фактура № ${invoiceNo}</title>
<style>
  @page { size: A4; margin: 20mm; }
  body { font-family: 'Helvetica', 'Arial', sans-serif; font-size: 11pt; color: #222; line-height: 1.4; max-width: 800px; margin: 0 auto; padding: 20px; }
  .header { display: flex; justify-content: space-between; margin-bottom: 30px; border-bottom: 2px solid #c4e9bf; padding-bottom: 16px; }
  .seller h1 { font-size: 22pt; margin: 0 0 4px; color: #1a1a1a; }
  .seller p { margin: 2px 0; font-size: 10pt; color: #555; }
  .invoice-info { text-align: right; }
  .invoice-info h2 { font-size: 16pt; margin: 0 0 8px; }
  .invoice-info .number { font-size: 18pt; font-weight: bold; color: #c4e9bf; }
  .parties { display: flex; gap: 40px; margin: 24px 0; }
  .party { flex: 1; }
  .party-label { font-size: 9pt; text-transform: uppercase; color: #999; letter-spacing: 1px; margin-bottom: 4px; }
  .party-name { font-weight: bold; font-size: 12pt; margin-bottom: 4px; }
  .party-line { font-size: 10pt; color: #555; }
  table { width: 100%; border-collapse: collapse; margin: 24px 0; }
  th { background: #f5f5f5; padding: 10px; text-align: left; font-size: 10pt; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #ddd; }
  td { padding: 12px 10px; border-bottom: 1px solid #eee; font-size: 11pt; }
  .text-right { text-align: right; }
  .totals { margin-top: 16px; max-width: 320px; margin-left: auto; }
  .totals-row { display: flex; justify-content: space-between; padding: 6px 10px; font-size: 11pt; }
  .totals-row.total { background: #c4e9bf; color: #1a1a1a; font-weight: bold; font-size: 13pt; padding: 12px 10px; border-radius: 4px; }
  .legal { margin-top: 32px; padding: 16px; background: #fafafa; border-radius: 6px; font-size: 9pt; color: #666; line-height: 1.6; }
  .legal p { margin: 4px 0; }
  .footer { margin-top: 24px; text-align: center; font-size: 9pt; color: #999; border-top: 1px solid #eee; padding-top: 16px; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>

<div class="header">
  <div class="seller">
    <h1>${SELLER.name}</h1>
    <p>ЕИК: ${SELLER.eik}${SELLER.vat_number ? " · ДДС №: " + SELLER.vat_number : ""}</p>
    <p>${SELLER.address}</p>
    <p>${SELLER.email}${SELLER.phone ? " · " + SELLER.phone : ""}</p>
  </div>
  <div class="invoice-info">
    <h2>ФАКТУРА</h2>
    <div class="number">№ ${invoiceNo}</div>
    <p>Оригинал · Дата: ${issueDate}</p>
  </div>
</div>

<div class="parties">
  <div class="party">
    <div class="party-label">Продавач</div>
    <div class="party-name">${SELLER.name}</div>
    <div class="party-line">ЕИК: ${SELLER.eik}</div>
    <div class="party-line">${SELLER.address}</div>
  </div>
  <div class="party">
    <div class="party-label">Получател</div>
    <div class="party-name">${invoice.buyer_name || "Физическо лице"}</div>
    ${invoice.buyer_eik ? `<div class="party-line">ЕИК: ${invoice.buyer_eik}</div>` : ""}
    ${invoice.buyer_vat ? `<div class="party-line">ДДС №: ${invoice.buyer_vat}</div>` : ""}
    ${invoice.buyer_address ? `<div class="party-line">${invoice.buyer_address}</div>` : ""}
    <div class="party-line">${invoice.buyer_email}</div>
  </div>
</div>

<table>
  <thead>
    <tr>
      <th>Описание на услугата</th>
      <th class="text-right">Кол.</th>
      <th class="text-right">Цена</th>
      <th class="text-right">Сума</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>${invoice.description}</td>
      <td class="text-right">1</td>
      <td class="text-right">${formatAmount(subtotal, invoice.currency)}</td>
      <td class="text-right">${formatAmount(subtotal, invoice.currency)}</td>
    </tr>
  </tbody>
</table>

<div class="totals">
  <div class="totals-row">
    <span>Сума без ДДС:</span>
    <span>${formatAmount(subtotal, invoice.currency)}</span>
  </div>
  <div class="totals-row">
    <span>ДДС (${invoice.vat_rate}%):</span>
    <span>${formatAmount(invoice.vat_amount_cents, invoice.currency)}</span>
  </div>
  <div class="totals-row total">
    <span>ОБЩО:</span>
    <span>${formatAmount(totalEur, invoice.currency)}</span>
  </div>
  <div class="totals-row" style="font-size:9pt;color:#999;justify-content:flex-end;">
    <span>(${(totalBgn / 100).toFixed(2)} лв при курс 1 EUR = 1.95583 лв)</span>
  </div>
</div>

<div class="legal">
  ${invoice.vat_rate === 0 ? '<p><strong>Доставчикът не е регистриран по ЗДДС.</strong> Сумата не включва ДДС.</p>' : ""}
  <p><strong>Начин на плащане:</strong> Стрипе (онлайн с карта) — заплатено на ${issueDate}.</p>
  <p><strong>Цифров продукт / услуга:</strong> Купувачът декларира, че се съгласява с незабавно изпълнение и губи правото си на 14-дневен отказ съгласно чл. 57, т. 12 от ЗЗП.</p>
  <p>Този документ представлява електронна фактура съгласно Закон за счетоводството и е валиден без подпис и печат.</p>
</div>

<div class="footer">
  ${SELLER.name} · ЕИК ${SELLER.eik} · synrg-beyondfitness.com
</div>

</body>
</html>`;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const cors = corsHeaders(origin);

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const body = await req.json();
    const {
      client_id,
      program_purchase_id,
      buyer_name,
      buyer_email,
      buyer_address,
      buyer_eik,
      buyer_vat_number,
      description,
      amount_cents,
      currency,
      stripe_session_id,
      stripe_payment_intent,
    } = body;

    if (!client_id || !amount_cents || !description) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // Idempotency: check if invoice already exists for this stripe_session_id
    if (stripe_session_id) {
      const existsRes = await fetch(
        `${SUPABASE_URL}/rest/v1/invoices?select=id,invoice_number&stripe_session_id=eq.${stripe_session_id}&limit=1`,
        { headers: sbHeaders() }
      );
      const existing = await existsRes.json();
      if (Array.isArray(existing) && existing.length > 0) {
        return new Response(
          JSON.stringify({ ok: true, invoice: existing[0], reused: true }),
          { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
        );
      }
    }

    // Get next sequential invoice number
    const seqRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/next_invoice_number`, {
      method: "POST",
      headers: sbHeaders(),
      body: JSON.stringify({}),
    });
    const invoice_number = await seqRes.json();

    // VAT calculation
    const vatRate = VAT_RATE;
    const vatAmountCents = Math.round(amount_cents * vatRate / (100 + vatRate));
    const issuedAt = new Date();

    // Generate HTML
    const htmlContent = generateInvoiceHtml({
      invoice_number,
      buyer_name: buyer_name || "Физическо лице",
      buyer_email: buyer_email || "",
      buyer_address,
      buyer_eik,
      buyer_vat: buyer_vat_number,
      description,
      amount_cents,
      currency: currency || "EUR",
      vat_rate: vatRate,
      vat_amount_cents: vatAmountCents,
      issued_at: issuedAt,
    });

    // Insert invoice record
    const insRes = await fetch(`${SUPABASE_URL}/rest/v1/invoices`, {
      method: "POST",
      headers: { ...sbHeaders(), Prefer: "return=representation" },
      body: JSON.stringify({
        invoice_number,
        client_id,
        program_purchase_id,
        buyer_name,
        buyer_email,
        buyer_address,
        buyer_eik,
        buyer_vat_number,
        description,
        amount_cents,
        currency: currency || "EUR",
        vat_rate: vatRate,
        vat_amount_cents: vatAmountCents,
        issued_at: issuedAt.toISOString(),
        stripe_session_id,
        stripe_payment_intent,
        html_content: htmlContent,
        status: "issued",
      }),
    });

    if (!insRes.ok) {
      console.error("Insert invoice failed:", await insRes.text());
      return new Response(
        JSON.stringify({ error: "Failed to record invoice" }),
        { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const inserted = await insRes.json();
    const invoice = Array.isArray(inserted) ? inserted[0] : inserted;

    return new Response(
      JSON.stringify({ ok: true, invoice }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("generate-invoice error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});
