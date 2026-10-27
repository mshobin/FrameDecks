// FrameDecks - writes public/api/sync-config before every build (and `npm run dev`).
// The desktop program asks <companion>/api/sync-config for the cloud's address and public key when a PC is linked
// (cloud_sync.companion_config), so neither is written into the program. Both are public by design (row-level
// security protects the data); no secret is here. A file instead of a server route, so the companion is plain static
// files any free host can serve (docs/architecture/hosting.md). The file is git-ignored: it is made from the two
// NEXT_PUBLIC_ variables of the host (Cloudflare Pages, Vercel) or hosted/.env.local.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const here = new URL("../", import.meta.url);

export function syncConfig(e) {
  const url = e.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = e.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  try {
    if (url && anonKey && new URL(url).protocol === "https:") return { url, anonKey };
  } catch {
    // not a URL: treated as not set up
  }
  return { error: "The cloud is not set up for this site yet." };
}

function readEnv() {
  const env = { ...process.env };
  for (const name of [".env.local", ".env"]) {                     // what `next` itself reads, for local builds
    const file = new URL(name, here);
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*"?([^"\r\n]*)"?\s*$/.exec(line);
      if (m && env[m[1]] === undefined) env[m[1]] = m[2];
    }
  }
  return env;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  mkdirSync(new URL("public/api/", here), { recursive: true });
  const body = syncConfig(readEnv());
  writeFileSync(new URL("public/api/sync-config", here), JSON.stringify(body));
  console.log(body.error ? "sync-config: " + body.error : "sync-config: written for " + body.url);
}
