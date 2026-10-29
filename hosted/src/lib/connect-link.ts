// FrameDecks - one-click linking (6.13; docs/project/2026-10-29-onboarding-linking-themes-plan.md section 2).
// The program opens https://framedecks.com/connect#code=K7PM2XQ9&name=Hall%20PC. The code rides in the fragment, so it
// never reaches a server log or a Referer header. Both sides show the same two-digit check number, worked out from
// the code (src/cloud_sync.py check_number does the same), so a person can see the request came from their own PC.
// Self-contained, with no imports, so the tests load it directly.

export type ConnectRequest = { code: string; name: string };

const CODE = /^[A-HJ-NP-Z2-9]{8}$/; // computer_link_start's alphabet (0003_sync.sql)

export function normalizeCode(code: string): string {
  return code.replace(/\s+/g, "").toUpperCase();
}

/** The request in the page's fragment, or null if there is none or it is malformed. */
export function parseConnect(hash: string): ConnectRequest | null {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const code = normalizeCode(params.get("code") ?? "");
  if (!CODE.test(code)) return null;
  const name = (params.get("name") ?? "").trim().slice(0, 80) || "A computer";
  return { code, name };
}

/** 10–99, from the first two bytes of SHA-256 of the code: the number the program shows beside "Waiting…". */
export async function checkNumber(code: string): Promise<number> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalizeCode(code))));
  return ((digest[0] << 8) | digest[1]) % 90 + 10;
}

// After signing in (another tab, if the email link opens one) the person comes back to the request they were on.
export const RETURN_KEY = "fd-after-sign-in";
const RETURN_MS = 15 * 60 * 1000;

type Storage = Pick<globalThis.Storage, "getItem" | "setItem" | "removeItem">;

export function rememberReturn(store: Storage, path: string, now = Date.now()): void {
  if (!path.startsWith("/connect")) return; // only the connect page; never an address from elsewhere
  try {
    store.setItem(RETURN_KEY, JSON.stringify({ path, at: now }));
  } catch {
    /* private window: the person opens the link from the program again */
  }
}

/** The page to return to (once), or null. Only a fresh /connect path on this site is ever returned. */
export function takeReturn(store: Storage, now = Date.now()): string | null {
  try {
    const raw = store.getItem(RETURN_KEY);
    store.removeItem(RETURN_KEY);
    const saved = raw ? (JSON.parse(raw) as { path?: unknown; at?: unknown }) : null;
    if (!saved || typeof saved.path !== "string" || typeof saved.at !== "number") return null;
    if (!saved.path.startsWith("/connect") || saved.path.startsWith("//") || now - saved.at > RETURN_MS) return null;
    return saved.path;
  } catch {
    return null;
  }
}
