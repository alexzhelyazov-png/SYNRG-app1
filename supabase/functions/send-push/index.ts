/**
 * Supabase Edge Function: send-push
 *
 * Sends a Web Push notification to one or more clients' registered devices.
 * Internal — guarded by `Authorization: Bearer <REPORT_EMAIL_TOKEN>`, the same
 * token the other internal automations use.
 *
 * POST {
 *   client_ids: string[] | client_id: string,
 *   title, body, url?, tag?,
 *   dry_run?: boolean
 * }
 *
 * Endpoints that answer 404/410 are GONE (uninstalled / permission revoked) and
 * are deleted immediately. Other failures bump fail_count and disable at 5, so a
 * permanently broken endpoint stops being retried forever.
 */

import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC  = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:info@synrg-beyondfitness.com";
const AUTH_TOKEN    = Deno.env.get("REPORT_EMAIL_TOKEN")!;

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

const sbHeaders = () => ({
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
});

type Sub = {
  id: string; client_id: string; endpoint: string;
  p256dh: string; auth: string; fail_count: number;
};

async function loadSubs(clientIds: string[]): Promise<Sub[]> {
  const inList = clientIds.map(encodeURIComponent).join(",");
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/push_subscriptions` +
    `?select=id,client_id,endpoint,p256dh,auth,fail_count` +
    `&client_id=in.(${inList})&disabled_at=is.null`,
    { headers: sbHeaders() },
  );
  if (!res.ok) throw new Error(`loadSubs failed: ${await res.text()}`);
  return res.json();
}

async function dropSub(id: string) {
  await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?id=eq.${id}`, {
    method: "DELETE", headers: { ...sbHeaders(), Prefer: "return=minimal" },
  });
}

async function noteFailure(sub: Sub) {
  const next = (sub.fail_count || 0) + 1;
  await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?id=eq.${sub.id}`, {
    method: "PATCH",
    headers: { ...sbHeaders(), Prefer: "return=minimal" },
    body: JSON.stringify({
      fail_count: next,
      disabled_at: next >= 5 ? new Date().toISOString() : null,
    }),
  });
}

async function noteSuccess(sub: Sub) {
  if (!sub.fail_count) return; // nothing to reset — skip the write
  await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?id=eq.${sub.id}`, {
    method: "PATCH",
    headers: { ...sbHeaders(), Prefer: "return=minimal" },
    body: JSON.stringify({ fail_count: 0 }),
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const auth = req.headers.get("authorization") || "";
  if (!AUTH_TOKEN || auth !== `Bearer ${AUTH_TOKEN}`) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }

  try {
    const b = await req.json();
    const clientIds: string[] = b.client_ids || (b.client_id ? [b.client_id] : []);
    if (!clientIds.length) return new Response(JSON.stringify({ error: "client_ids required" }), { status: 400 });
    if (!b.title) return new Response(JSON.stringify({ error: "title required" }), { status: 400 });

    const subs = await loadSubs(clientIds);
    if (b.dry_run) {
      return new Response(JSON.stringify({ ok: true, dry_run: true, would_send: subs.length }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const payload = JSON.stringify({
      title: b.title,
      body:  b.body || "",
      url:   b.url  || "/app/",
      tag:   b.tag  || "synrg",
    });

    let sent = 0, gone = 0, failed = 0;
    for (const s of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        );
        sent++;
        await noteSuccess(s);
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) { await dropSub(s.id); gone++; }
        else { await noteFailure(s); failed++; console.warn(`push failed (${code}):`, String(e).slice(0, 200)); }
      }
    }

    return new Response(JSON.stringify({ ok: true, devices: subs.length, sent, gone, failed }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-push error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
