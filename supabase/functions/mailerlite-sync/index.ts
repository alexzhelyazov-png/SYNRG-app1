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

// Send a transactional email via Brevo
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
  });
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

    const { action, email, name, fields, subject, html } = await req.json();

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
      await upsertContact(apiKey, email, name, {
        PLAN_TYPE: fields?.plan_type || "",
        PLAN_EXPIRES: fields?.plan_expires || "",
        PLAN_STATUS: "active",
      });

      // Send plan activation email
      const planLabel =
        fields?.plan_type === "unlimited"
          ? "Unlimited"
          : `${fields?.plan_type} visits`;
      await sendTransactionalEmail(
        apiKey,
        { email, name },
        "Your plan is activated!",
        `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#1a1a1a;color:#e0e0e0;border-radius:16px">
          <h2 style="color:#c4e9bf;margin:0 0 16px">${name || "Hey"},</h2>
          <p style="font-size:16px;line-height:1.6">Your <strong style="color:#c4e9bf">${planLabel}</strong> plan at SYNRG Beyond Fitness is now active!</p>
          <p style="font-size:14px;color:#999">Valid until: <strong style="color:#e0e0e0">${fields?.plan_expires || "N/A"}</strong></p>
          <hr style="border:none;border-top:1px solid #333;margin:24px 0">
          <p style="font-size:12px;color:#666">SYNRG Beyond Fitness</p>
        </div>`
      );
      return ok({ contact: true, email_sent: true });
    }

    // ── Plan updated (expired, paused, etc.) ──────────────
    if (action === "plan_updated") {
      await upsertContact(apiKey, email, name, {
        PLAN_STATUS: fields?.plan_status || "",
        PLAN_EXPIRES: fields?.plan_expires || "",
      });

      // If expired, send notification
      if (fields?.plan_status === "expired") {
        await sendTransactionalEmail(
          apiKey,
          { email, name },
          "Your plan has expired",
          `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#1a1a1a;color:#e0e0e0;border-radius:16px">
            <h2 style="color:#c4e9bf;margin:0 0 16px">${name || "Hey"},</h2>
            <p style="font-size:16px;line-height:1.6">Your plan at SYNRG Beyond Fitness has expired.</p>
            <p style="font-size:14px;color:#999">Contact us to renew and keep training!</p>
            <hr style="border:none;border-top:1px solid #333;margin:24px 0">
            <p style="font-size:12px;color:#666">SYNRG Beyond Fitness</p>
          </div>`
        );
      }
      return ok({ contact: true });
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
