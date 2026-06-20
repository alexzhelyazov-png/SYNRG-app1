/**
 * Supabase Edge Function: Brevo (ex-Sendinblue) Email Sync
 *
 * Actions:
 * - 'register'       → Create/update contact + send welcome email
 * - 'plan_activated'  → Update contact attributes + send plan confirmation
 * - 'plan_updated'    → Update contact attributes (expired, paused, etc.)
 * - 'send_email'      → Send a transactional email (forgot password, etc.)
 *
 * Brevo API docs: https://developers.brevo.com/reference
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BREVO_API = "https://api.brevo.com/v3";
const SENDER = { name: "SYNRG Beyond Fitness", email: "info@synrg-beyondfitness.com" };

async function brevoFetch(
  path: string,
  apiKey: string,
  method = "GET",
  body?: Record<string, unknown>
) {
  const opts: RequestInit = {
    method,
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BREVO_API}${path}`, opts);
  if (!res.ok) {
    const text = await res.text();
    console.error(`Brevo ${res.status}: ${text}`);
    return null;
  }
  if (res.status === 204) return {};
  return res.json();
}

// Create or update a Brevo contact
async function upsertContact(
  apiKey: string,
  email: string,
  name?: string,
  attributes?: Record<string, unknown>
) {
  const contactData: Record<string, unknown> = {
    email,
    updateEnabled: true,
    attributes: {
      ...(name ? { FIRSTNAME: name } : {}),
      ...(attributes || {}),
    },
  };
  return brevoFetch("/contacts", apiKey, "POST", contactData);
}

// Strip HTML to a readable plain-text version. Helps Gmail/Outlook classify the
// message as transactional (not promotional) and improves deliverability.
function htmlToText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, "$2 ($1)")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Send a transactional email via Brevo. Includes plain-text alternative + transactional
// headers so Gmail classifies it as Primary (not Promotions).
async function sendTransactionalEmail(
  apiKey: string,
  to: { email: string; name?: string },
  subject: string,
  htmlContent: string
) {
  return brevoFetch("/smtp/email", apiKey, "POST", {
    sender: SENDER,
    to: [to],
    subject,
    htmlContent,
    textContent: htmlToText(htmlContent),
    // Transactional indicators — signal to Gmail/Outlook this is a service email,
    // not a marketing message. Reduces likelihood of Promotions / spam routing.
    headers: {
      "X-Entity-Ref-ID": `synrg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      "X-Mailer": "SYNRG Beyond Fitness",
    },
  });
}

// ── DB-backed templates ────────────────────────────────────
// Every client-facing email lives in public.email_automations so the admin
// can view/edit/toggle it from the app. We fetch the row (service role),
// substitute {tokens}, and send. Falls back to the caller-supplied html if the
// row is missing — so a missing/broken row never blocks a critical email.
function fillTokens(s: string, vars: Record<string, unknown>): string {
  let out = s || "";
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{${k}}`).join(v == null ? "" : String(v));
  }
  return out;
}

async function loadTemplate(
  key: string
): Promise<{ subject: string; body_html: string; enabled: boolean } | null> {
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !svc) return null;
    const res = await fetch(
      `${url}/rest/v1/email_automations?select=subject,body_html,enabled&key=eq.${encodeURIComponent(key)}&limit=1`,
      { headers: { apikey: svc, Authorization: `Bearer ${svc}` } }
    );
    if (!res.ok) return null;
    const rows = await res.json();
    return rows?.[0] || null;
  } catch (e) {
    console.warn(`loadTemplate(${key}) failed:`, e);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const apiKey = Deno.env.get("BREVO_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "BREVO_API_KEY not configured" }),
        {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    const { action, email, name, fields, subject, html, key, vars, optional } =
      await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    const ok = (data: unknown) =>
      new Response(JSON.stringify({ success: true, data }), {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });

    // ── Register: create contact ──────────────────────────
    if (action === "register") {
      const result = await upsertContact(apiKey, email, name);
      return ok(result);
    }

    // ── Plan activated: update attributes + send email ────
    if (action === "plan_activated") {
      const planType = fields?.PLAN_TYPE || fields?.plan_type || "";
      const planExpires = fields?.PLAN_EXPIRES || fields?.plan_expires || "";

      await upsertContact(apiKey, email, name, {
        PLAN_TYPE: planType,
        PLAN_EXPIRES: planExpires,
        PLAN_STATUS: "active",
      });

      // Send plan activation email
      const planLabel =
        planType === "unlimited"
          ? "Неограничен"
          : `${planType} посещения`;
      const fallbackActHtml = `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#1a1a1a;color:#e0e0e0;border-radius:16px">
          <h2 style="color:#c4e9bf;margin:0 0 16px">${name || "Hey"},</h2>
          <p style="font-size:16px;line-height:1.6">Планът ти <strong style="color:#c4e9bf">${planLabel}</strong> в SYNRG Beyond Fitness е активиран!</p>
          <p style="font-size:14px;color:#999">Валиден до: <strong style="color:#e0e0e0">${planExpires}</strong></p>
          <hr style="border:none;border-top:1px solid #333;margin:24px 0">
          <p style="font-size:12px;color:#666">SYNRG Beyond Fitness</p>
        </div>`;
      const actTpl = await loadTemplate("plan_activated");
      const actVars = { name: name || "Hey", planLabel, planExpires };
      await sendTransactionalEmail(
        apiKey,
        { email, name },
        actTpl ? fillTokens(actTpl.subject, actVars) : "Планът ти е активиран!",
        actTpl ? fillTokens(actTpl.body_html, actVars) : fallbackActHtml
      );
      return ok({ contact: true, email_sent: true });
    }

    // ── Plan updated (expired, paused, etc.) ──────────────
    if (action === "plan_updated") {
      const updStatus = fields?.PLAN_STATUS || fields?.plan_status || "";
      const updExpires = fields?.PLAN_EXPIRES || fields?.plan_expires || "";

      await upsertContact(apiKey, email, name, {
        PLAN_STATUS: updStatus,
        PLAN_EXPIRES: updExpires,
      });

      if (updStatus === "expired") {
        const fallbackExpHtml = `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#1a1a1a;color:#e0e0e0;border-radius:16px">
            <h2 style="color:#c4e9bf;margin:0 0 16px">${name || "Hey"},</h2>
            <p style="font-size:16px;line-height:1.6">Планът ти в SYNRG Beyond Fitness изтече.</p>
            <p style="font-size:14px;color:#999">Свържи се с нас за подновяване!</p>
            <hr style="border:none;border-top:1px solid #333;margin:24px 0">
            <p style="font-size:12px;color:#666">SYNRG Beyond Fitness</p>
          </div>`;
        const expTpl = await loadTemplate("plan_expired");
        const expVars = { name: name || "Hey" };
        await sendTransactionalEmail(
          apiKey,
          { email, name },
          expTpl ? fillTokens(expTpl.subject, expVars) : "Планът ти изтече",
          expTpl ? fillTokens(expTpl.body_html, expVars) : fallbackExpHtml
        );
      }
      return ok({ contact: true });
    }

    // ── Send a DB-backed template email ───────────────────
    // Body: { key, email, name, vars?, subject (fallback), html (fallback), optional? }
    // optional=true → respect the row's `enabled` flag (skip if disabled).
    // optional=false/omitted → always send (critical transactional); use the
    // row text when present, otherwise the caller-supplied fallback.
    if (action === "send_template") {
      if (!key) {
        return new Response(JSON.stringify({ error: "key is required" }), {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
      const tpl = await loadTemplate(key);
      if (optional && tpl && tpl.enabled === false) {
        return ok({ skipped: true, reason: "disabled" });
      }
      const tokens = { name: name || "", ...(vars || {}) };
      const finalSubject = tpl
        ? fillTokens(tpl.subject, tokens)
        : subject || "";
      const finalHtml = tpl ? fillTokens(tpl.body_html, tokens) : html || "";
      if (!finalSubject || !finalHtml) {
        return new Response(
          JSON.stringify({ error: "no template row and no fallback subject/html" }),
          {
            status: 400,
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          }
        );
      }
      const result = await sendTransactionalEmail(
        apiKey,
        { email, name },
        finalSubject,
        finalHtml
      );
      return ok({ sent: true, used_template: !!tpl, data: result });
    }

    // ── Send transactional email (forgot password, etc.) ──
    if (action === "send_email") {
      if (!subject || !html) {
        return new Response(
          JSON.stringify({ error: "subject and html are required" }),
          {
            status: 400,
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          }
        );
      }
      const result = await sendTransactionalEmail(
        apiKey,
        { email, name },
        subject,
        html
      );
      return ok(result);
    }

    return new Response(
      JSON.stringify({ error: `Unknown action: ${action}` }),
      {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Brevo sync error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
