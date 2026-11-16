// FrameDecks 9.8 - Trusted Devices (docs/architecture/trusted-workspace.md).
//
// After the emailed one-time link, the workspace session lives only in this tab (sessionStorage) until the person
// chooses "Trust This Device". A trusted device keeps the session in localStorage, so the next visit opens the
// workspace with no new link, and it keeps a random device token that only it holds (the cloud keeps the token's
// hash: migration 0015). At every start a trusted device checks its token; a removed device, or one trusted more
// than 180 days ago, forgets the session and asks for a new link.
//
// The PKCE code verifier always goes to localStorage: the emailed link may open in a new tab, which has an empty
// sessionStorage.

export const TRUST_KEY = "fd-trusted-device";
const LEGACY_DECIDED_KEY = "fd-trust-decided";
/** This tab: "Just this visit" was chosen (or "This is a shared computer" when joining), so nothing asks again. */
export const ASKED_KEY = "fd-trust-asked";

export type TrustRecord = { token: string; id: string; name: string; expiresAt: string };
export type DeviceStatus = "trusted" | "revoked" | "expired" | "unknown";

type KV = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

export function readTrust(local: KV | undefined = globalThis.localStorage): TrustRecord | null {
  return safe(() => {
    const raw = local?.getItem(TRUST_KEY);
    if (!raw) return null;
    const t = JSON.parse(raw) as TrustRecord;
    return t && typeof t.token === "string" && t.token.length >= 40 ? t : null;
  }, null);
}

export function writeTrust(record: TrustRecord, local: KV | undefined = globalThis.localStorage) {
  safe(() => local?.setItem(TRUST_KEY, JSON.stringify(record)), undefined);
  safe(() => local?.setItem(LEGACY_DECIDED_KEY, "1"), undefined);
}

export function clearTrust(local: KV | undefined = globalThis.localStorage) {
  safe(() => local?.removeItem(TRUST_KEY), undefined);
}

/** Before 9.8 every session was kept in localStorage. Such a browser keeps it (nothing changes for people already
 * using the website) until it is trusted or the person chooses "Just this visit". */
export function isLegacyKeep(local: KV | undefined = globalThis.localStorage): boolean {
  return safe(() => local?.getItem(LEGACY_DECIDED_KEY) !== "1", false);
}

export function markDecided(local: KV | undefined = globalThis.localStorage) {
  safe(() => local?.setItem(LEGACY_DECIDED_KEY, "1"), undefined);
}

/** The Supabase client's storage: localStorage on a trusted device (and for the PKCE verifier), this tab otherwise.
 * The stores are looked up at each call, so a client made before the page is in a browser still works. */
export function deviceStorage(localIn?: KV, tabIn?: KV): KV {
  const L = () => localIn ?? safe(() => globalThis.localStorage, undefined);
  const T = () => tabIn ?? safe(() => globalThis.sessionStorage, undefined);
  const keep = (key: string) =>
    key.endsWith("-code-verifier") || !!readTrust(L()) || (isLegacyKeep(L()) && !!safe(() => L()?.getItem(key), null));
  return {
    getItem: (key) => safe(() => (keep(key) ? L()?.getItem(key) : T()?.getItem(key)) ?? null, null),
    setItem: (key, value) => {
      safe(() => (keep(key) ? L() : T())?.setItem(key, value), undefined);
    },
    removeItem: (key) => {
      safe(() => L()?.removeItem(key), undefined);
      safe(() => T()?.removeItem(key), undefined);
    },
  };
}

/** Trusting moves the session from this tab to the device; "Just this visit" moves it the other way. */
export function moveSession(toDevice: boolean, local: KV | undefined = globalThis.localStorage, tab: KV | undefined = globalThis.sessionStorage) {
  const store = toDevice ? local : tab;
  const from = toDevice ? tab : local;
  const keys = safe(() => {
    const s = from as Storage | undefined;
    const out: string[] = [];
    for (let i = 0; s && i < s.length; i++) {
      const k = s.key(i);
      if (k && /^sb-.+-auth-token$/.test(k)) out.push(k);
    }
    return out;
  }, [] as string[]);
  for (const k of keys) {
    const v = safe(() => from?.getItem(k), null);
    if (v != null) {
      safe(() => store?.setItem(k, v), undefined);
      safe(() => from?.removeItem(k), undefined);
    }
  }
}

/** 26.11.12 Scan to join: where a new device keeps its workspace. A shared computer keeps it in this tab only, like
 * "Just this visit"; any other device keeps it like a Trusted Device (trust_device right after joining moves it to the
 * device, with keepOnDevice). Either way the new session starts in this tab, so a code that fails leaves nothing
 * behind on the device. */
export type KeepChoice = "tab" | "device";
export function storageChoice(shared: boolean): KeepChoice {
  return shared ? "tab" : "device";
}

/** Before signing a new device in on a shared computer: this tab only, and no Trust This Device question. */
export function keepInTabOnly(local: KV | undefined = globalThis.localStorage, tab: KV | undefined = globalThis.sessionStorage) {
  safe(() => tab?.setItem(ASKED_KEY, "1"), undefined);
  if (isLegacyKeep(local)) markDecided(local);
}

/** After trust_device: the token on the device and the session moved there. */
export function keepOnDevice(
  record: TrustRecord,
  local: KV | undefined = globalThis.localStorage,
  tab: KV | undefined = globalThis.sessionStorage,
) {
  writeTrust(record, local);
  moveSession(true, local, tab);
}

/** A plain name for the device list: "Chrome on Windows", "Safari on iPhone". */
export function deviceName(ua: string = globalThis.navigator?.userAgent ?? ""): string {
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox"
    : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const system = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android"
    : /Windows/.test(ua) ? "Windows" : /Mac OS X|Macintosh/.test(ua) ? "Mac" : /CrOS/.test(ua) ? "Chromebook"
    : /Linux/.test(ua) ? "Linux" : "this device";
  return `${browser} on ${system}`;
}

/** 26.11.58 (release sign-off L12): the Data API's refusal for a removed or expired Trusted Device's session (0015
 * check_trusted_session). Seen on any request, it ends the session here at once instead of at the next device check. */
export function isUntrustedAnswer(status: number, body: string): boolean {
  return (status === 401 || status === 403) && body.includes("no longer trusted");
}

/** What a device-check answer means for the person. */
export function statusMessage(status: DeviceStatus): string | null {
  if (status === "revoked") return "This device was removed from your workspace. Open your workspace again to continue here.";
  if (status === "expired") return "It has been 180 days since this device was trusted. Open your workspace again to keep it trusted.";
  return null;
}
