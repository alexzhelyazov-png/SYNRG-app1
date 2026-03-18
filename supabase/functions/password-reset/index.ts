/**
 * Supabase Edge Function: Password Reset
 *
 * Actions:
 * - 'request' → Generate 6-digit code, store in DB, send via Brevo
 * - 'verify'  → Check code + update password
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BREVO_API = "https://api.brevo.com/v3";
const SENDER = {
  name: "SYNRG Beyond Fitness",
  email: "info@synrg-beyondfitness.com",
};

function jsonRes(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const brevoKey = Deno.env.get("BREVO_API_KEY")!;

    const sbHeaders = {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    };

    const { action, email, code, new_password } = await req.json();

    if (!email) return jsonRes({ error: "Email is required" }, 400);

    // ── REQUEST: generate code and send email ──────────────
    if (action === "request") {
      // Find client by email
      const clientRes = await fetch(
        `${supabaseUrl}/rest/v1/clients?email=eq.${encodeURIComponent(email)}&is_coach=eq.false&select=id,name,email&limit=1`,
        { headers: sbHeaders }
      );
      const clients = await clientRes.json();
      if (!clients || clients.length === 0) {
        return jsonRes({ error: "no_account" }, 404);
      }

      const client = clients[0];
      const resetCode = generateCode();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 min

      // Delete old codes for this email
      await fetch(
        `${supabaseUrl}/rest/v1/password_resets?email=eq.${encodeURIComponent(email)}`,
        { method: "DELETE", headers: sbHeaders }
      );

      // Insert new code
      await fetch(`${supabaseUrl}/rest/v1/password_resets`, {
        method: "POST",
        headers: { ...sbHeaders, Prefer: "return=minimal" },
        body: JSON.stringify({
          email,
          code: resetCode,
          expires_at: expiresAt,
          client_id: client.id,
        }),
      });

      // Send email via Brevo
      await fetch(`${BREVO_API}/smtp/email`, {
        method: "POST",
        headers: {
          "api-key": brevoKey,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          sender: SENDER,
          to: [{ email, name: client.name }],
          subject: "Password reset code",
          htmlContent: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#1a1a1a;color:#e0e0e0;border-radius:16px">
            <h2 style="color:#c4e9bf;margin:0 0 16px">${client.name},</h2>
            <p style="font-size:16px;line-height:1.6">Your password reset code is:</p>
            <div style="text-align:center;margin:24px 0">
              <span style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#c4e9bf;background:#252525;padding:16px 32px;border-radius:12px;display:inline-block">${resetCode}</span>
            </div>
            <p style="font-size:14px;color:#999">This code expires in 15 minutes. If you didn't request this, ignore this email.</p>
            <hr style="border:none;border-top:1px solid #333;margin:24px 0">
            <p style="font-size:12px;color:#666">SYNRG Beyond Fitness</p>
          </div>`,
        }),
      });

      return jsonRes({ success: true, name: client.name });
    }

    // ── VERIFY: check code and update password ────────────
    if (action === "verify") {
      if (!code || !new_password) {
        return jsonRes(
          { error: "code and new_password are required" },
          400
        );
      }

      // Find valid reset code
      const now = new Date().toISOString();
      const resetRes = await fetch(
        `${supabaseUrl}/rest/v1/password_resets?email=eq.${encodeURIComponent(email)}&code=eq.${code}&expires_at=gte.${now}&select=*&limit=1`,
        { headers: sbHeaders }
      );
      const resets = await resetRes.json();
      if (!resets || resets.length === 0) {
        return jsonRes({ error: "invalid_code" }, 400);
      }

      const reset = resets[0];

      // Update password
      await fetch(
        `${supabaseUrl}/rest/v1/clients?id=eq.${reset.client_id}`,
        {
          method: "PATCH",
          headers: { ...sbHeaders, Prefer: "return=minimal" },
          body: JSON.stringify({ password: new_password }),
        }
      );

      // Delete used code
      await fetch(
        `${supabaseUrl}/rest/v1/password_resets?email=eq.${encodeURIComponent(email)}`,
        { method: "DELETE", headers: sbHeaders }
      );

      return jsonRes({ success: true });
    }

    return jsonRes({ error: `Unknown action: ${action}` }, 400);
  } catch (err) {
    console.error("Password reset error:", err);
    return jsonRes({ error: (err as Error).message }, 500);
  }
});
