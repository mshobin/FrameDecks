// FrameDecks 26.11.38 - the email code is the main way in (components/workspace-sync-form.tsx). Small rules kept here
// so they can be tested: how the address is shown back, what counts as a full code, which answers mean "no workspace
// for that email" (shown exactly like a sent code, so nobody can test which emails are members), and whose computer
// this is (a browser that never opened FrameDecks starts as someone else's).

export const CODE_LENGTH = 6;
export const RESEND_SECONDS = 30;
const SEEN = "fd-seen"; // this browser opened a workspace before as "Mine"

/** m•••@gmail.com: enough to recognise, not enough for someone looking over a shoulder. */
export function maskEmail(email: string): string {
  const at = email.trim().lastIndexOf("@");
  if (at < 1) return email.trim();
  const name = email.trim().slice(0, at);
  return `${name[0]}${"•".repeat(Math.min(3, Math.max(1, name.length - 1)))}${email.trim().slice(at)}`;
}

/** The digits of a pasted or typed code, at most CODE_LENGTH. */
export function codeDigits(text: string): string {
  return text.replace(/\D/g, "").slice(0, CODE_LENGTH);
}

/** Supabase's answer when the email has no workspace yet (shouldCreateUser: false). */
export function noWorkspaceYet(error: { message?: string; code?: string; status?: number } | null): boolean {
  if (!error) return false;
  return error.code === "otp_disabled" || /signups? not allowed|user not found|not allowed for otp/i.test(error.message ?? "");
}

export type Whose = "mine" | "theirs";

/** A browser that opened FrameDecks before as Mine starts as Mine; any other starts as someone else's. */
export function defaultWhose(local: Pick<Storage, "getItem"> | undefined = globalThis.localStorage): Whose {
  try {
    return local?.getItem(SEEN) === "1" ? "mine" : "theirs";
  } catch {
    return "theirs";
  }
}

export function rememberMine(local: Pick<Storage, "setItem"> | undefined = globalThis.localStorage) {
  try {
    local?.setItem(SEEN, "1");
  } catch {
    /* storage blocked: asked again next time */
  }
}
