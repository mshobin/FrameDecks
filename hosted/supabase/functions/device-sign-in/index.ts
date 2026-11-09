// FrameDecks 26.11.26 - device-sign-in: a phone that scanned an Add a device code becomes signed in as that person
// (docs/architecture/passwordless.md). Runs in Supabase Edge Functions, the only place that holds the service key:
//   1. device_code_redeem (0021) uses the code once and says whose account it is (wrong codes are counted per network);
//   2. Supabase Auth makes a one-time sign-in for that email (nothing is emailed);
//   3. the phone turns it into its own session with supabase.auth.verifyOtp({ token_hash, type: "magiclink" }).
// No anonymous sign-ins are involved. Deploy: supabase functions deploy device-sign-in --no-verify-jwt (the phone has no
// session yet; the code itself is the proof).
import { createClient } from "jsr:@supabase/supabase-js@2";

const HEADERS = {
  "Access-Control-Allow-Origin": "*", // no cookies are used: the one-time code is the only credential
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const answer = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: HEADERS });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: HEADERS });
  if (req.method !== "POST") return answer({ status: "error" }, 405);
  let code = "";
  let device = "";
  try {
    const body = await req.json();
    code = String(body?.code ?? "").slice(0, 40);
    device = String(body?.device ?? "").slice(0, 80);
  } catch {
    return answer({ status: "wrong" }, 400);
  }
  if (!/[A-Za-z0-9]{6,}/.test(code)) return answer({ status: "wrong" });
  const net = (req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await admin.rpc("device_code_redeem", { code, net, device_name: device });
  if (error) return answer({ status: "error" }, 500);
  if (data?.status !== "ok") return answer({ status: data?.status ?? "wrong" });
  const link = await admin.auth.admin.generateLink({ type: "magiclink", email: data.email });
  const tokenHash = link.data?.properties?.hashed_token;
  if (link.error || !tokenHash) return answer({ status: "error" }, 500);
  return answer({ status: "ok", tokenHash, organizationId: data.organizationId, organizationName: data.organizationName });
});
