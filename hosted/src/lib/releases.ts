// The FrameDecks release manifest (7.0): what api.framedecks.com/releases/latest answers, written by
// tools/make_release_manifest.py when a version is published to Cloudflare R2 (docs/deployment/release-pipeline.md).
// The website's download page and the program's updater (src/updater.py) read the same fields.

export const UPDATE_API = (
  process.env.NEXT_PUBLIC_UPDATE_API || "https://api.framedecks.com"
).replace(/\/+$/, "");
export const DOWNLOADS_HOST = "https://downloads.framedecks.com";

export type PlatformBuild = {
  url: string;
  sha256: string;
  size: number;
  file: string;
};
export type Release = {
  version: string;
  released: string;
  downloadUrl: string;
  sha256: string;
  size: number;
  releaseNotes: string;
  platforms: Partial<Record<"windows" | "macos" | "linux", PlatformBuild>>;
  minimumOs?: string;
};

const HEX64 = /^[0-9a-f]{64}$/;

/** Accept only a well-formed manifest whose downloads come from downloads.framedecks.com. */
export function parseRelease(data: unknown): Release | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const version =
    typeof d.version === "string" && /^\d+(\.\d+){1,3}$/.test(d.version)
      ? d.version
      : null;
  const url = typeof d.downloadUrl === "string" ? d.downloadUrl : "";
  const sha = typeof d.sha256 === "string" ? d.sha256.toLowerCase() : "";
  if (!version || !url.startsWith(`${DOWNLOADS_HOST}/`) || !HEX64.test(sha))
    return null;
  const platforms: Release["platforms"] = {};
  const raw =
    d.platforms && typeof d.platforms === "object"
      ? (d.platforms as Record<string, unknown>)
      : {};
  for (const key of ["windows", "macos", "linux"] as const) {
    const p = raw[key] as Record<string, unknown> | undefined;
    if (
      p &&
      typeof p.url === "string" &&
      p.url.startsWith(`${DOWNLOADS_HOST}/`) &&
      typeof p.sha256 === "string" &&
      HEX64.test(p.sha256.toLowerCase())
    ) {
      platforms[key] = {
        url: p.url,
        sha256: p.sha256.toLowerCase(),
        size: Number(p.size) || 0,
        file: String(p.file ?? p.url.split("/").pop()),
      };
    }
  }
  return {
    version,
    released: typeof d.released === "string" ? d.released : "",
    downloadUrl: url,
    sha256: sha,
    size: Number(d.size) || 0,
    releaseNotes: typeof d.releaseNotes === "string" ? d.releaseNotes : "",
    platforms,
    minimumOs: typeof d.minimumOs === "string" ? d.minimumOs : undefined,
  };
}

export type Os = "windows" | "macos" | "linux" | "other";

/** The visitor's computer, from the browser's own hints (phones and tablets count as "other"). */
export function detectOs(ua: string, platform = ""): Os {
  const s = `${platform} ${ua}`.toLowerCase();
  if (/android|iphone|ipad|ipod|mobile/.test(s)) return "other";
  if (/win/.test(s)) return "windows";
  if (/mac/.test(s)) return "macos";
  if (/linux|x11|cros/.test(s)) return "linux";
  return "other";
}

export function formatSize(bytes: number): string {
  if (!bytes) return "";
  return bytes >= 1024 * 1024
    ? `${Math.round(bytes / (1024 * 1024))} MB`
    : `${Math.round(bytes / 1024)} KB`;
}

export type NoteBlock = { heading: string; items: string[] };

/** The release notes' sections ("## What's New" … with "- " items) as plain text blocks; nothing is rendered as HTML. */
export function noteBlocks(markdown: string): NoteBlock[] {
  const out: NoteBlock[] = [];
  let cur: NoteBlock | null = null;
  for (const raw of markdown.split("\n")) {
    const line = raw.trimEnd();
    const h = /^##\s+(.+)$/.exec(line);
    if (h) {
      cur = { heading: h[1].trim(), items: [] };
      out.push(cur);
    } else if (cur && /^-\s+/.test(line)) {
      cur.items.push(line.replace(/^-\s+/, ""));
    } else if (cur && /^\s{2,}\S/.test(raw) && cur.items.length) {
      cur.items[cur.items.length - 1] += ` ${line.trim()}`;
    }
  }
  return out
    .map((b) => ({
      heading: b.heading,
      items: b.items
        .map((i) => i.replace(/\*\*|`/g, ""))
        .filter((i) => !/^none in this release\.?$/i.test(i)),
    }))
    .filter((b) => b.items.length);
}

export type DownloadState = "checking" | "ready" | "unavailable";

/** What the download page may offer: a download link only for a checked manifest (never a guessed address, which
 *  would be a dead link while the download service is not answering or not set up yet). */
export function downloadState(
  checked: boolean,
  release: Release | null,
): DownloadState {
  if (release) return "ready";
  return checked ? "unavailable" : "checking";
}

// 26.11.63 how a release is named on the website: "FrameDecks v26.11", "Stable Release", "Updated November 2026".
// The build number (26.11.63) stays in the small print and on GitHub, where support needs it.
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October",
  "November", "December"];

/** "26.11.63" → "v26.11" (YY.MM); anything else is shown as it is. */
export function shortVersion(version: string): string {
  const m = /^v?(\d{2})\.(\d{1,2})(?:\.\d+)?$/.exec(version.trim());
  return m ? `v${m[1]}.${m[2].padStart(2, "0")}` : version;
}

/** "Updated November 2026": from the release date ("2026-11-18") when the update service gives one, else from the
 * version itself (YY.MM is the year and month of the release). "" when neither says. */
export function updatedLabel(released: string, version: string): string {
  const d = /^(\d{4})-(\d{2})/.exec(released || "");
  if (d && +d[2] >= 1 && +d[2] <= 12) return `Updated ${MONTHS[+d[2] - 1]} ${d[1]}`;
  const v = /^v?(\d{2})\.(\d{1,2})/.exec((version || "").trim());
  if (v && +v[2] >= 1 && +v[2] <= 12) return `Updated ${MONTHS[+v[2] - 1]} 20${v[1]}`;
  return "";
}
