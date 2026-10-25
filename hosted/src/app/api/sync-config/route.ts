import { readSupabaseConfig } from "@/lib/supabase-config";

// The FRAMEDECKS desktop program asks here for the cloud's address and public key when a PC is linked, so neither
// is written into the program. Both are public by design (row-level security protects the data); no secret is here.
export function GET() {
  const config = readSupabaseConfig();
  if (!config) {
    return Response.json({ error: "The cloud is not set up for this site yet." }, { status: 503 });
  }
  return Response.json(
    { url: config.url, anonKey: config.anonKey },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}
