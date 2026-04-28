/**
 * Supabase Edge Function: Monthly NAP Report (Naredba Н-18)
 *
 * Generates monthly XML + CSV report of all sales for НАП (БГ tax authority).
 * Schedule: cron monthly on the 1st at 6:00 UTC
 *
 * Setup cron:
 *   SELECT cron.schedule('monthly-nap-report', '0 6 1 * *',
 *     $$SELECT net.http_post(
 *       'https://nzrtdqlgljcipfmectwp.supabase.co/functions/v1/monthly-nap-report',
 *       '{}', '{"Authorization":"Bearer <service_role_key>"}', 'application/json'
 *     )$$
 *   );
 *
 * Sends report to accountant email.
 * Can also be triggered manually via POST { month: "2026-04" } for any month.
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BREVO_API = "https://api.brevo.com/v3";
const BREVO_KEY = Deno.env.get("BREVO_API_KEY")!;

// Recipient — set to accountant email
const ACCOUNTANT_EMAIL = Deno.env.get("ACCOUNTANT_EMAIL") || "aleksandarzhelyazov@gmail.com";

const SELLER = {
  name: "Синерджи 93 ООД",
  eik: "207343690",
  vat_number: "",
};

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

function escapeXml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function escapeCsv(s: string): string {
  const str = String(s ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function previousMonthRange(): { from: string; to: string; label: string } {
  const now = new Date();
  const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const firstOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastOfPrevMonth = new Date(firstOfThisMonth.getTime() - 1);
  return {
    from: firstOfPrevMonth.toISOString().slice(0, 10),
    to: lastOfPrevMonth.toISOString().slice(0, 10),
    label: firstOfPrevMonth.toISOString().slice(0, 7), // "2026-03"
  };
}

function specificMonthRange(yyyymm: string): { from: string; to: string; label: string } {
  const [y, m] = yyyymm.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const last = new Date(y, m, 0); // day 0 of next month = last of this
  return {
    from: first.toISOString().slice(0, 10),
    to: last.toISOString().slice(0, 10),
    label: yyyymm,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

  try {
    let range = previousMonthRange();
    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (body?.month && /^\d{4}-\d{2}$/.test(body.month)) {
          range = specificMonthRange(body.month);
        }
      } catch { /* use default range */ }
    }

    // Fetch all invoices in the month
    const invRes = await fetch(
      `${SUPABASE_URL}/rest/v1/invoices?select=*&issued_at=gte.${range.from}T00:00:00&issued_at=lte.${range.to}T23:59:59&order=invoice_number.asc`,
      { headers: sbHeaders() }
    );
    const invoices = await invRes.json() as Array<{
      invoice_number: number;
      buyer_name: string;
      buyer_email: string;
      buyer_eik: string | null;
      buyer_vat_number: string | null;
      description: string;
      amount_cents: number;
      currency: string;
      vat_rate: number;
      vat_amount_cents: number;
      issued_at: string;
      stripe_session_id: string | null;
      status: string;
    }>;

    // Also include refunds in the period
    const refundsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/program_purchases?select=id,client_id,amount_cents,currency,refunded_at&status=eq.refunded&refunded_at=gte.${range.from}T00:00:00&refunded_at=lte.${range.to}T23:59:59`,
      { headers: sbHeaders() }
    );
    const refunds = await refundsRes.json() as Array<{
      id: string;
      client_id: string;
      amount_cents: number;
      currency: string;
      refunded_at: string;
    }>;

    // Build XML
    const xmlLines = [
      `<?xml version="1.0" encoding="UTF-8"?>`,
      `<NapMonthlyReport>`,
      `  <Header>`,
      `    <Seller>`,
      `      <Name>${escapeXml(SELLER.name)}</Name>`,
      `      <EIK>${SELLER.eik}</EIK>`,
      SELLER.vat_number ? `      <VATNumber>${SELLER.vat_number}</VATNumber>` : "",
      `    </Seller>`,
      `    <Period>`,
      `      <From>${range.from}</From>`,
      `      <To>${range.to}</To>`,
      `      <Month>${range.label}</Month>`,
      `    </Period>`,
      `    <GeneratedAt>${new Date().toISOString()}</GeneratedAt>`,
      `  </Header>`,
      `  <Invoices count="${invoices.length}">`,
    ];

    let totalGrossCents = 0;
    let totalVatCents = 0;
    for (const inv of invoices) {
      totalGrossCents += inv.amount_cents;
      totalVatCents += inv.vat_amount_cents;
      xmlLines.push(`    <Invoice>`);
      xmlLines.push(`      <Number>${String(inv.invoice_number).padStart(10, "0")}</Number>`);
      xmlLines.push(`      <Date>${inv.issued_at.slice(0, 10)}</Date>`);
      xmlLines.push(`      <Buyer>`);
      xmlLines.push(`        <Name>${escapeXml(inv.buyer_name || "Физическо лице")}</Name>`);
      if (inv.buyer_eik) xmlLines.push(`        <EIK>${inv.buyer_eik}</EIK>`);
      if (inv.buyer_vat_number) xmlLines.push(`        <VATNumber>${inv.buyer_vat_number}</VATNumber>`);
      xmlLines.push(`      </Buyer>`);
      xmlLines.push(`      <Description>${escapeXml(inv.description)}</Description>`);
      xmlLines.push(`      <Currency>${inv.currency}</Currency>`);
      xmlLines.push(`      <NetAmount>${((inv.amount_cents - inv.vat_amount_cents) / 100).toFixed(2)}</NetAmount>`);
      xmlLines.push(`      <VATRate>${inv.vat_rate}</VATRate>`);
      xmlLines.push(`      <VATAmount>${(inv.vat_amount_cents / 100).toFixed(2)}</VATAmount>`);
      xmlLines.push(`      <GrossAmount>${(inv.amount_cents / 100).toFixed(2)}</GrossAmount>`);
      xmlLines.push(`      <Status>${inv.status}</Status>`);
      if (inv.stripe_session_id) xmlLines.push(`      <PaymentRef>${inv.stripe_session_id}</PaymentRef>`);
      xmlLines.push(`    </Invoice>`);
    }
    xmlLines.push(`  </Invoices>`);

    if (refunds.length > 0) {
      xmlLines.push(`  <Refunds count="${refunds.length}">`);
      for (const r of refunds) {
        xmlLines.push(`    <Refund>`);
        xmlLines.push(`      <Date>${r.refunded_at.slice(0, 10)}</Date>`);
        xmlLines.push(`      <Amount>${(r.amount_cents / 100).toFixed(2)}</Amount>`);
        xmlLines.push(`      <Currency>${r.currency}</Currency>`);
        xmlLines.push(`    </Refund>`);
      }
      xmlLines.push(`  </Refunds>`);
    }

    xmlLines.push(`  <Totals>`);
    xmlLines.push(`    <InvoiceCount>${invoices.length}</InvoiceCount>`);
    xmlLines.push(`    <GrossTotal>${(totalGrossCents / 100).toFixed(2)}</GrossTotal>`);
    xmlLines.push(`    <VATTotal>${(totalVatCents / 100).toFixed(2)}</VATTotal>`);
    xmlLines.push(`    <RefundCount>${refunds.length}</RefundCount>`);
    xmlLines.push(`  </Totals>`);
    xmlLines.push(`</NapMonthlyReport>`);

    const xml = xmlLines.filter(l => l !== "").join("\n");

    // Build CSV
    const csvLines = [
      ["Номер на фактура", "Дата", "Купувач", "ЕИК", "ДДС №", "Описание", "Валута", "Нето", "ДДС %", "ДДС сума", "Бруто", "Статус"].map(escapeCsv).join(","),
    ];
    for (const inv of invoices) {
      csvLines.push([
        String(inv.invoice_number).padStart(10, "0"),
        inv.issued_at.slice(0, 10),
        inv.buyer_name || "Физическо лице",
        inv.buyer_eik || "",
        inv.buyer_vat_number || "",
        inv.description,
        inv.currency,
        ((inv.amount_cents - inv.vat_amount_cents) / 100).toFixed(2),
        inv.vat_rate,
        (inv.vat_amount_cents / 100).toFixed(2),
        (inv.amount_cents / 100).toFixed(2),
        inv.status,
      ].map(escapeCsv).join(","));
    }
    const csv = "\uFEFF" + csvLines.join("\n"); // BOM for Excel UTF-8

    // Email accountant with both files attached
    const xmlB64 = btoa(unescape(encodeURIComponent(xml)));
    const csvB64 = btoa(unescape(encodeURIComponent(csv)));

    const emailRes = await fetch(`${BREVO_API}/smtp/email`, {
      method: "POST",
      headers: { "api-key": BREVO_KEY, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        sender: { name: "SYNRG Beyond Fitness", email: "info@synrg-beyondfitness.com" },
        to: [{ email: ACCOUNTANT_EMAIL }],
        subject: `НАП месечен отчет — ${range.label}`,
        htmlContent: `<div style="font-family:sans-serif;padding:20px;max-width:560px">
          <h2>Месечен отчет за продажби — ${range.label}</h2>
          <p>Период: ${range.from} — ${range.to}</p>
          <p><strong>Издадени фактури:</strong> ${invoices.length}</p>
          <p><strong>Обща сума бруто:</strong> ${(totalGrossCents / 100).toFixed(2)} EUR</p>
          <p><strong>ДДС:</strong> ${(totalVatCents / 100).toFixed(2)} EUR</p>
          <p><strong>Възстановявания:</strong> ${refunds.length}</p>
          <hr>
          <p>Прикачени са XML и CSV файлове за подаване в НАП и за счетоводството.</p>
          <p style="font-size:11px;color:#666">${SELLER.name} · ЕИК ${SELLER.eik} · Auto-generated</p>
        </div>`,
        attachment: [
          { name: `nap-report-${range.label}.xml`, content: xmlB64 },
          { name: `sales-${range.label}.csv`, content: csvB64 },
        ],
      }),
    });

    return new Response(JSON.stringify({
      success: true,
      period: range,
      invoices: invoices.length,
      refunds: refunds.length,
      gross_eur: (totalGrossCents / 100).toFixed(2),
      vat_eur: (totalVatCents / 100).toFixed(2),
      email_sent: emailRes.ok,
    }), { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("monthly-nap-report error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
