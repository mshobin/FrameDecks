// What the Live page shows about a PC, from the status the PC publishes (src/cloud_remote.py status_from) and the
// database's clock. Pure functions, so they are tested without a browser (tests/live-view.test.mjs).

export type LiveStatus = {
  frame: { id: string; name: string; number: number } | null;
  count: number;
  frames: { id: string; name: string }[];
  script: string;
  question: { visible: boolean; text: string };
  scripture: { visible: boolean; text: string; ref: string; version: string };
  blackout: boolean;
  freeze: boolean;
};

export type LiveComputer = {
  id: string;
  name: string;
  status: LiveStatus | null;
  updated_at: string | null;
  server_now: string;
};

export type Op = "next" | "previous" | "go_live" | "hide_all" | "blackout" | "question" | "scripture";

// The PC sends its status at least every 30 seconds while switched on (every 4 while a phone is active), so a
// status older than this means the PC is off, offline or "Allow control from the companion" is off.
export const ONLINE_FOR_SECONDS = 45;

export function isOnline(pc: Pick<LiveComputer, "updated_at" | "server_now">): boolean {
  if (!pc.updated_at) return false;
  const age = (Date.parse(pc.server_now) - Date.parse(pc.updated_at)) / 1000;
  return Number.isFinite(age) && age < ONLINE_FOR_SECONDS;
}

export function nowShowing(status: LiveStatus | null): string {
  if (!status) return "Nothing yet";
  if (!status.frame) return status.count ? "No Frame on screen" : "No Frames in this plan";
  return `Frame ${status.frame.number} of ${status.count} · ${status.frame.name}`;
}

const labels: Record<Op, string> = {
  next: "Next Frame",
  previous: "Previous Frame",
  go_live: "Go Live",
  hide_all: "Hide all",
  blackout: "Black screen",
  question: "Question",
  scripture: "Scripture",
};

export function label(op: Op, args: Record<string, unknown> = {}): string {
  if (op === "blackout") return args.on ? "Black screen on" : "Black screen off";
  if (op === "question" || op === "scripture") return `${labels[op]} ${args.show ? "shown" : "hidden"}`;
  return labels[op];
}

/** The PC's answer to a command, in words for the phone. */
export function outcome(result: string | null): string {
  if (result === null) return "Sent…";
  if (result === "done") return "Done";
  if (result === "expired") return "Not run: the PC did not take it within 10 seconds";
  if (result === "refused") return "Not run: you are no longer allowed to run services";
  return result.charAt(0).toUpperCase() + result.slice(1);
}
