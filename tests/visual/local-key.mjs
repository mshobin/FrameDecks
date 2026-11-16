// 26.11.58 (release sign-off L2): the program's key for requests from this PC, as its own windows use it.
// The program keeps the key in kc-local-token.txt in its data folder (KC_DATA_DIR, else the repository folder when it
// runs as `python src/server.py`). A page opened once with ?t=KEY gets the key's cookie (and the address without the
// key); scripts send it in the X-FrameDecks-Key header. Overlay pages (OBS) never need it, so tests open those without.
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

export function localKey() {
  try { return readFileSync(join(process.env.KC_DATA_DIR || ROOT, "kc-local-token.txt"), "utf8").trim(); }
  catch { return ""; }
}

export function keyHeaders() {
  const key = localKey();
  return key ? { "X-FrameDecks-Key": key } : {};
}

// Opens a small file of the program with ?t=KEY: the program sets its cookie and sends the page to the address
// without the key. Returns the page (for chaining); throws when the key was not taken.
export async function unlock(page, base) {
  const key = localKey();
  if (!key) throw new Error("No kc-local-token.txt in the program's data folder (set KC_DATA_DIR as for the program)");
  await page.goto(`${base}/icons/favicon-16.png?t=${encodeURIComponent(key)}`);
  if (page.url().includes("t=")) throw new Error("the program kept the key in the address");
  const cookies = await page.context().cookies(base);
  if (!cookies.some((c) => c.name === "fd_local" && c.httpOnly)) throw new Error("the program did not set its key cookie");
  return page;
}
