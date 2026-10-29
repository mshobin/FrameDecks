// FrameDecks - is the program on this computer? (design: docs/architecture/meeting-form.md, section 4)
// The installer adds the FrameRelay camera, so a video input with that name means the program is installed. The
// website never talks to the program; it only reads the camera names the browser shows and offers the
// framedecks:// link the installer registers. Self-contained, with no imports, so the tests load it directly.

export const OPEN_LINK = "framedecks://open";
export const DOWNLOADS = "/download"; // 7.0: every download goes through framedecks.com/download, never GitHub

// The camera's names: today's, and those of versions published under the program's earlier names
const CAMERA_NAMES = [/framerelay/i, /framecast/i, /framedecks/i, /bcc vcam/i]; // the camera's name, and its earlier names

export type Place = "windows" | "phone" | "other";
export type Setup =
  | "phone" // a phone or tablet: the companion is for Live and editing there, nothing to install
  | "other" // a Mac or Linux computer: FrameDecks for Windows only (the Mac camera is separate)
  | "ask" // Windows, camera names not shown yet: ask to check
  | "found" // the FrameRelay camera is on this PC
  | "missing"; // cameras are named, none is FrameRelay

export function placeOf(userAgent: string): Place {
  if (/android|iphone|ipad|ipod|mobile/i.test(userAgent)) return "phone";
  return /windows/i.test(userAgent) ? "windows" : "other";
}

export function isFramedecksCamera(label: string): boolean {
  return CAMERA_NAMES.some((name) => name.test(label));
}

/** labels: the names of this computer's video inputs ("" while the browser keeps them hidden). */
export function setupOf(place: Place, labels: string[]): Setup {
  if (place !== "windows") return place;
  if (labels.some(isFramedecksCamera)) return "found";
  // Names are shown only after camera access was allowed: no names (or no cameras) means "not checked yet"
  return labels.some((l) => l.trim()) ? "missing" : "ask";
}
