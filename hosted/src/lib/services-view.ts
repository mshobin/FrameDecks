// FRAMEDECKS - what the companion shows of a synced plan: each Frame's Content as readable lines, media as a note
// that it stays on the service PC. Pure functions, no imports, so the tests can load this file directly.

type Obj = { [key: string]: unknown };

export type ContentView = { kind: string; title: string; lines: string[]; media?: string };
export type FrameView = {
  id: string;
  name: string;
  group: string;
  template: boolean;
  script: string;
  content: ContentView[];
};
export type MemberView = {
  id: string;
  name: string;
  country: string;
  phone: string;
  email: string;
  birthDate: string;
  role: string;
};

const KIND_NAMES: Record<string, string> = {
  scripture: "Scripture",
  question: "Question",
  birthday: "Birthday",
  announcement: "Announcement",
  prayer: "Prayer Point",
  lowerthird: "Lower Third",
  countdown: "Countdown",
  brand: "Branding",
  camera: "Camera",
  screen: "Screen",
  window: "Window",
  image: "Image",
  video: "Video",
  pdf: "PowerPoint",
  background: "Background",
  text: "Text",
  rect: "Shape",
  ellipse: "Ellipse",
};
const MEDIA = ["image", "video", "pdf"];
const TITLED = ["announcement", "prayer", "lowerthird", "countdown"];

const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string => (v === undefined || v === null ? "" : String(v)).trim();
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

function describeContent(layer: Obj): ContentView {
  const kind = str(layer.kind);
  const c = isObj(layer.c) ? layer.c : {};
  const title = str(layer.name) || KIND_NAMES[kind] || kind || "Content";
  const view: ContentView = { kind, title, lines: [] };
  if (MEDIA.includes(kind)) {
    view.media = str(c.file);
    return view;
  }
  if (kind === "question") {
    view.lines = list(c.items).filter(isObj).map((it) => str(it.text)).filter(Boolean);
  } else if (kind === "scripture") {
    view.lines = list(c.items)
      .filter(isObj)
      .map((it) => {
        const ref = [str(it.ref), str(it.version) && `(${str(it.version)})`].filter(Boolean).join(" ");
        return [ref, str(it.text)].filter(Boolean).join(": ");
      })
      .filter(Boolean);
  } else if (TITLED.includes(kind)) {
    view.lines = [str(c.title), str(c.text)].filter(Boolean);
  } else if (kind === "text") {
    const props = isObj(c.props) ? c.props : {};
    view.lines = [str(props.text)].filter(Boolean);
  }
  return view;
}

/** The plan's Frames in their order, as the Services page shows them. */
export function describeFrames(plan: Obj): FrameView[] {
  return list(plan.scenes)
    .filter(isObj)
    .map((frame) => ({
      id: str(frame.id),
      name: str(frame.name) || "Frame",
      group: str(frame.group),
      template: frame.tpl === true,
      script: str(frame.notes),
      content: list(frame.layers).filter(isObj).map(describeContent),
    }));
}

export function describeMembers(members: unknown[]): MemberView[] {
  return list(members)
    .filter(isObj)
    .map((m) => ({
      id: str(m.id),
      name: str(m.name),
      country: str(m.country),
      phone: str(m.phone),
      email: str(m.email),
      birthDate: str(m.birthDate),
      role: str(m.role),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
