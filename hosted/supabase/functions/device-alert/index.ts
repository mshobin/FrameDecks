// FrameDecks 26.11.36 - device-alert: emails a workspace's owners and admins when a PC is connected or a device joins
// its team (docs/architecture/passwordless.md, "New-device alerts"). Called by a Supabase Database Webhook on INSERT
// into public.device_alerts (0023), with the header x-alert-secret. Runs in Supabase Edge Functions with the service key:
//   1. device_alert_take (0023) takes the alert once (a webhook that fires twice sends once) and says to whom;
//   2. one plain email to each owner and admin through Brevo's transactional API;
//   3. if no email could be sent, device_alert_release gives the alert back for a retry.
// Secrets (Edge Functions -> Secrets): BREVO_API_KEY, ALERT_FROM (e.g. no-reply@framedecks.com), ALERT_WEBHOOK_SECRET.
// Optional: SITE_URL (default https://framedecks.com). Missing secrets are logged and answered with 200, so the
// webhook never retries forever. Deploy: supabase functions deploy device-alert --no-verify-jwt (the webhook sends no
// user token; the shared secret is the proof).
import { createClient } from "jsr:@supabase/supabase-js@2";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function sameSecret(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

function utc(at: string): string {
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return "just now";
  const date = d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
  return `${date}, ${time} UTC`;
}

type Alert = { status: string; kind: "pc" | "device"; deviceName: string; createdAt: string; workspace: string; to: string[] };

function message(a: Alert, site: string) {
  const what = a.kind === "pc" ? "PC" : "device";
  const workspace = a.workspace || "your workspace";
  const subject = `A new ${what} was connected to ${workspace}`;
  const text = [
    `A new ${what} was connected to ${workspace} on FrameDecks.`,
    "",
    `${a.kind === "pc" ? "PC" : "Device"}: ${a.deviceName}`,
    `Time: ${utc(a.createdAt)}`,
    "",
    `If this wasn't you, remove it in Devices on framedecks.com: ${site}/devices`,
    "",
    "You get this email because you are an owner or admin of this workspace.",
  ].join("\n");
  return { subject, text };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ status: "error" }, 405);
  const secret = Deno.env.get("ALERT_WEBHOOK_SECRET") ?? "";
  if (!secret) {
    console.error("device-alert: ALERT_WEBHOOK_SECRET is not set; nothing sent");
    return json({ status: "not-set-up" });
  }
  if (!sameSecret(req.headers.get("x-alert-secret") ?? "", secret)) return json({ status: "refused" }, 401);

  let id = 0;
  try {
    const body = await req.json();
    if (body?.type !== "INSERT" || body?.table !== "device_alerts") return json({ status: "ignored" });
    id = Number(body?.record?.id);
  } catch {
    return json({ status: "ignored" }, 400);
  }
  if (!Number.isSafeInteger(id) || id <= 0) return json({ status: "ignored" });

  const apiKey = Deno.env.get("BREVO_API_KEY") ?? "";
  const from = Deno.env.get("ALERT_FROM") ?? "";
  if (!apiKey || !from) {
    console.error("device-alert: BREVO_API_KEY or ALERT_FROM is not set; alert", id, "not emailed");
    return json({ status: "not-set-up" });
  }
  const site = (Deno.env.get("SITE_URL") ?? "https://framedecks.com").replace(/\/+$/, "");
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await admin.rpc("device_alert_take", { alert: id });
  if (error) {
    console.error("device-alert: device_alert_take failed", error.message);
    return json({ status: "error" });
  }
  const alert = data as Alert;
  if (alert?.status !== "ok") return json({ status: "done" });
  if (!alert.to?.length) return json({ status: "no-one" });

  const { subject, text } = message(alert, site);
  let sent = 0;
  for (const to of alert.to) {
    try {
      const r = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ sender: { name: "FrameDecks", email: from }, to: [{ email: to }], subject, textContent: text }),
      });
      if (r.ok) sent++;
      else console.error("device-alert: Brevo answered", r.status, await r.text());
    } catch (e) {
      console.error("device-alert: Brevo could not be reached", String(e));
    }
  }
  if (!sent) {
    await admin.rpc("device_alert_release", { alert: id });
    return json({ status: "not-sent" });
  }
  return json({ status: "sent", sent });
});
