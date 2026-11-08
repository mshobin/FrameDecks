// The Setup guide's steps (6.14): the same ids, titles and places as the program's app/js/guide-steps.js, kept equal
// by tests/guide-steps.test.js. "both" steps can be done (and seen) on the website too; "program" steps only on the PC.

export type GuideStep = Readonly<{
  id: string;
  title: string;
  where: "both" | "program";
  optional?: boolean;
  text: string;
}>;

export const GUIDE_STEPS: readonly GuideStep[] = [
  {
    id: "welcome",
    title: "Welcome",
    where: "both",
    text: "What kind of gathering do you lead? FrameDecks makes a ready set of Frames for it.",
  },
  {
    id: "output",
    title: "How people will see it",
    where: "program",
    text: "Zoom or Teams as a camera, a shared window, or a projector, TV or OBS.",
  },
  {
    id: "phone",
    title: "Your phone as a remote",
    where: "program",
    optional: true,
    text: "Scan the code with your phone’s camera. Your phone and this PC need the same Wi-Fi.",
  },
  {
    id: "connect",
    title: "Add a device",
    where: "program",
    optional: true,
    text: "Plan together on the website; your plans reach this PC by themselves.",
  },
  {
    id: "frame",
    title: "Make your first Frame",
    where: "both",
    text: "Add a Frame, or change one of the ready ones. A Frame is one moment on screen: a verse, a question, a picture or a welcome.",
  },
  {
    id: "ready",
    title: "Ready",
    where: "program",
    text: "FrameDecks checks that everything is working. Anything that is not has a button to fix it.",
  },
];

export const GUIDE_KINDS = [
  { id: "bible-study", name: "Bible Study" },
  { id: "prayer", name: "Prayer Meeting" },
  { id: "youth", name: "Youth Gathering" },
  { id: "fellowship", name: "Fellowship Meeting" },
  { id: "other", name: "Something else" },
] as const;

export const GUIDE_KEY = "fd-guide";

export type GuideProgress = { kind?: string; hidden?: boolean };

/** This browser's guide progress (the website keeps it in local storage; the program in kc-app-settings.json). */
export function readGuide(store: Pick<Storage, "getItem">): GuideProgress {
  try {
    const v = JSON.parse(store.getItem(GUIDE_KEY) ?? "{}") as unknown;
    if (!v || typeof v !== "object") return {};
    const o = v as Record<string, unknown>;
    return {
      kind: GUIDE_KINDS.some((k) => k.id === o.kind)
        ? String(o.kind)
        : undefined,
      hidden: o.hidden === true,
    };
  } catch {
    return {};
  }
}

export function writeGuide(
  store: Pick<Storage, "setItem">,
  progress: GuideProgress,
) {
  try {
    store.setItem(GUIDE_KEY, JSON.stringify(progress));
  } catch {
    /* private window: the guide simply starts again */
  }
}

/** A Frame added or changed on the website (its record was last saved by a person, "user:…", not a PC): the website's
 * own "first Frame". The program ticks the same step from its own plan. */
export function frameChangedOnWebsite(
  records: readonly { kind: string; deleted?: boolean; updatedBy?: string }[],
): boolean {
  return records.some(
    (r) =>
      r.kind === "frame" &&
      !r.deleted &&
      (r.updatedBy ?? "").startsWith("user:"),
  );
}
