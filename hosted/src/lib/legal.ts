// Which Terms of Service and Privacy Policy are current (docs/legal/terms.md and privacy.md, "Version 2026-11-18"),
// and the acceptance a new person ticked before their account existed (recorded by accept_terms once signed in).
export const TERMS_VERSION = "2026-11-18";      // 26.11.64: laws of England and Wales, 18+, no longer a draft: everyone accepts again
export const PENDING_KEY = "fd-terms-accepted";

export function rememberAcceptance(
  store: Pick<Storage, "setItem">,
  now = Date.now(),
) {
  try {
    store.setItem(
      PENDING_KEY,
      JSON.stringify({ version: TERMS_VERSION, at: now }),
    );
  } catch {
    /* the acceptance screen asks again after sign-in */
  }
}

/** A tick from the sign-up form in the last day, for the current version; read once. */
export function takeAcceptance(
  store: Pick<Storage, "getItem" | "removeItem">,
  now = Date.now(),
): boolean {
  try {
    const v = JSON.parse(store.getItem(PENDING_KEY) ?? "null") as {
      version?: string;
      at?: number;
    } | null;
    store.removeItem(PENDING_KEY);
    return (
      !!v &&
      v.version === TERMS_VERSION &&
      typeof v.at === "number" &&
      now - v.at < 24 * 3600 * 1000
    );
  } catch {
    return false;
  }
}

/** Database not updated yet (0011_accounts_legal.sql not run): the column or the function is missing. */
export function legalNotSetUp(
  error: { code?: string; message?: string } | null,
): boolean {
  if (!error) return false;
  return (
    ["42703", "PGRST202", "PGRST204", "42883"].includes(error.code ?? "") ||
    /terms_version|accept_terms/.test(error.message ?? "")
  );
}
