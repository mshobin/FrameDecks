// The cookie notice (7.0). framedecks.com stores only what it needs (docs/legal/cookies.md), so today there is one
// category, "essential", which needs no consent; the notice just tells people. The record is ready for optional
// categories (analytics, marketing) if any are ever added: they stay off until someone turns them on.

export const CONSENT_KEY = "fd-consent";
export const CONSENT_VERSION = "2026-10-29";
const YEAR = 365 * 24 * 3600 * 1000;

export type Consent = {
  version: string;
  at: number;
  essential: true;
  analytics: boolean;
};

export function readConsent(
  store: Pick<Storage, "getItem">,
  now = Date.now(),
): Consent | null {
  try {
    const c = JSON.parse(
      store.getItem(CONSENT_KEY) ?? "null",
    ) as Consent | null;
    if (
      !c ||
      c.version !== CONSENT_VERSION ||
      typeof c.at !== "number" ||
      now - c.at > YEAR
    )
      return null;
    return {
      version: c.version,
      at: c.at,
      essential: true,
      analytics: c.analytics === true,
    };
  } catch {
    return null;
  }
}

export function saveConsent(
  store: Pick<Storage, "setItem">,
  analytics = false,
  now = Date.now(),
): Consent {
  const c: Consent = {
    version: CONSENT_VERSION,
    at: now,
    essential: true,
    analytics,
  };
  try {
    store.setItem(CONSENT_KEY, JSON.stringify(c));
  } catch {
    /* private window: the notice shows again next time */
  }
  return c;
}
