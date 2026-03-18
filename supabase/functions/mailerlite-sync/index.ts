/**
 * Supabase Edge Function: MailerLite Sync
 *
 * Syncs client data to MailerLite when:
 * - A new client registers (action: 'register')
 * - A plan is activated (action: 'plan_activated')
 * - A plan expires or is changed (action: 'plan_updated')
 *
 * MailerLite API docs: https://developers.mailerlite.com/docs
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ML_API = "https://connect.mailerlite.com/api";

async function mlFetch(
  path: string,
  apiKey: string,
  method = "GET",
  body?: Record<string, unknown>
) {
  const opts: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${ML_API}${path}`, opts);
  if (!res.ok) {
    const text = await res.text();
    console.error(`MailerLite ${res.status}: ${text}`);
    return null;
  }
  return res.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const apiKey = Deno.env.get("MAILERLITE_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "MAILERLITE_API_KEY not configured" }),
        {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    const { action, email, name, fields } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    // Build subscriber data for MailerLite
    const subscriberData: Record<string, unknown> = {
      email,
    };

    if (name) subscriberData.fields = { name, ...(fields || {}) };
    else if (fields) subscriberData.fields = fields;

    if (action === "register") {
      // Create or update subscriber
      const result = await mlFetch(
        "/subscribers",
        apiKey,
        "POST",
        subscriberData
      );

      return new Response(JSON.stringify({ success: true, data: result }), {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    if (action === "plan_activated") {
      // Update subscriber fields with plan info
      subscriberData.fields = {
        name: name || undefined,
        plan_type: fields?.plan_type || "",
        plan_expires: fields?.plan_expires || "",
        plan_status: "active",
        ...(fields || {}),
      };

      const result = await mlFetch(
        "/subscribers",
        apiKey,
        "POST",
        subscriberData
      );

      return new Response(JSON.stringify({ success: true, data: result }), {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    if (action === "plan_updated") {
      // Update plan status (expired, paused, etc.)
      subscriberData.fields = {
        plan_status: fields?.plan_status || "",
        plan_expires: fields?.plan_expires || "",
        ...(fields || {}),
      };

      const result = await mlFetch(
        "/subscribers",
        apiKey,
        "POST",
        subscriberData
      );

      return new Response(JSON.stringify({ success: true, data: result }), {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ error: `Unknown action: ${action}` }),
      {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("MailerLite sync error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
