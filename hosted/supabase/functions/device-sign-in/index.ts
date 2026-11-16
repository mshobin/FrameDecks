// FrameDecks 26.11.26 - device-sign-in: a phone that scanned an Add a device code becomes signed in as that person
// (docs/architecture/passwordless.md). Runs in Supabase Edge Functions, the only place that holds the service key:
//   1. device_code_redeem (0021, 0029) uses the code once and says whose account it is (wrong codes are counted per network);
//   2. Supabase Auth makes a one-time sign-in for that email (nothing is emailed);
//   3. the phone turns it into its own session with supabase.auth.verifyOtp({ token_hash, type: "magiclink" }).
// No anonymous sign-ins are involved. Deploy: supabase functions deploy device-sign-in --no-verify-jwt (the phone has no
// session yet; the code itself is the proof).
//
// 26.11.58 (release sign-off H2): a code made by a church PC no longer signs the phone straight in, because anyone with
// the PC's key could make one. The account holder approves first:
//   a. {code, device}: device_code_redeem answers 'confirm' without using the code; this function emails the account
//      holder a one-time 6-digit code (Supabase Auth, as for the email sign-in) and answers {status: 'confirm', who}
//      with the address masked. The full address never goes to the phone.
//   b. {code, device, otp}: the address is looked up again (device_code_confirm_email, nothing used), Supabase Auth
//      checks the 6 digits, and only then device_code_confirm uses the code. The answer carries the session
//      ({accessToken, refreshToken}) for supabase.auth.setSession(). Wrong digits are counted (device_code_confirm with
//      false) and never use the code; the fifth wrong try ends it.
// Codes made on the website by a signed-in person are unchanged (step 1-3 above).
import { createClient } from "jsr:@supabase/supabase-js@2";

const HEADERS = {
  "Access-Control-Allow-Origin": "*", // no cookies are used: the one-time code is the only credential
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const answer = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: HEADERS });
const NO_SESSION = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: HEADERS });
  if (req.method !== "POST") return answer({ status: "error" }, 405);
  let code = "";
  let device = "";
  let otp = "";
  try {
    const body = await req.json();
    code = String(body?.code ?? "").slice(0, 40);
    device = String(body?.device ?? "").slice(0, 80);
    otp = String(body?.otp ?? "").replace(/\s+/g, "").slice(0, 12);
  } catch {
    return answer({ status: "wrong" }, 400);
  }
  if (!/[A-Za-z0-9]{6,}/.test(code)) return answer({ status: "wrong" });
  const net = (req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: NO_SESSION });

  // b. the account holder's 6 digits came back
  if (otp) {
    if (!/^\d{6}$/.test(otp)) return answer({ status: "otp-wrong" });
    const look = await admin.rpc("device_code_confirm_email", { code, net });
    if (look.error) return answer({ status: "error" }, 500);
    if (look.data?.status !== "confirm" || !look.data?.email) return answer({ status: look.data?.status ?? "wrong" });
    const anon = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { auth: NO_SESSION });
    const checked = await anon.auth.verifyOtp({ email: look.data.email, token: otp, type: "email" });
    const session = checked.data?.session;
    if (checked.error || !session) {
      const counted = await admin.rpc("device_code_confirm", { code, net, device_name: device, otp_ok: false });
      if (counted.error) return answer({ status: "error" }, 500);
      return answer({ status: counted.data?.status ?? "otp-wrong", left: counted.data?.left });
    }
    const done = await admin.rpc("device_code_confirm", { code, net, device_name: device, otp_ok: true });
    if (done.error || done.data?.status !== "ok") {
      await admin.auth.admin.signOut(session.access_token, "local").catch(() => undefined); // the session is not handed out
      return done.error ? answer({ status: "error" }, 500) : answer({ status: done.data?.status ?? "expired" });
    }
    return answer({
      status: "ok",
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      organizationId: done.data.organizationId,
      organizationName: done.data.organizationName,
    });
  }

  const { data, error } = await admin.rpc("device_code_redeem", { code, net, device_name: device });
  if (error) return answer({ status: "error" }, 500);
  // a. made by a PC: email the account holder their 6 digits (at most once a minute; the database says when)
  if (data?.status === "confirm") {
    let sent = !data.send;
    if (data.send) {
      const mail = await admin.auth.signInWithOtp({ email: data.email, options: { shouldCreateUser: false } });
      sent = !mail.error;
    }
    return answer({ status: "confirm", who: data.who, sent });
  }
  if (data?.status !== "ok") return answer({ status: data?.status ?? "wrong" });
  const link = await admin.auth.admin.generateLink({ type: "magiclink", email: data.email });
  const tokenHash = link.data?.properties?.hashed_token;
  if (link.error || !tokenHash) return answer({ status: "error" }, 500);
  return answer({ status: "ok", tokenHash, organizationId: data.organizationId, organizationName: data.organizationName });
});
