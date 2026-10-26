// The FRAMEDECKS program on this PC, as the Stream Deck plugin sees it: it finds the program's port (8750, or the
// next free one up to 8760), runs one action like its key (POST /api/command) and reads what is on screen
// (GET /api/command/status). Only this PC can use these addresses; nothing goes over the network.

export const PORTS = Array.from({ length: 11 }, (_, i) => 8750 + i);

export class FrameDecks {
  constructor({ fetchImpl = globalThis.fetch, timeoutMs = 5000 } = {}) {
    this.fetch = fetchImpl;
    this.timeoutMs = timeoutMs;
    this.port = null;
  }

  async request(port, path, body) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), this.timeoutMs);
    try {
      const res = await this.fetch(`http://127.0.0.1:${port}${path}`, {
        method: body ? "POST" : "GET",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        signal: ctl.signal,
      });
      if (!res.ok) throw new Error(`FRAMEDECKS answered ${res.status}`);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  /** The port FRAMEDECKS listens on: the one that worked last time, else the first that answers as FRAMEDECKS. */
  async findPort() {
    if (this.port !== null) return this.port;
    for (const port of PORTS) {
      try {
        const st = await this.request(port, "/api/command/status");
        if (st && st.app === "FRAMEDECKS") return (this.port = port);
      } catch {
        // not running on this port
      }
    }
    throw new Error("FRAMEDECKS is not running on this PC");
  }

  async call(path, body) {
    const port = await this.findPort();
    try {
      return await this.request(port, path, body);
    } catch (e) {
      this.port = null; // restarted on another port? look again next time
      throw e;
    }
  }

  status() {
    return this.call("/api/command/status");
  }

  /** Runs an action; resolves to {ok, result}. result is "done" or why not ("not run: …"). */
  run(op, args = {}) {
    return this.call("/api/command", { op, args });
  }
}

/** The command a key sends, from the status shown now (toggles ask for the opposite of what is on screen). */
export function commandFor(kind, status, settings = {}) {
  switch (kind) {
    case "next":
    case "previous":
      return { op: kind, args: {} };
    case "hideall":
      return { op: "hide_all", args: {} };
    case "blackout":
      return { op: "blackout", args: { on: !status?.blackout } };
    case "question":
      return { op: "question", args: { show: !status?.question } };
    case "scripture":
      return { op: "scripture", args: { show: !status?.scripture } };
    case "golive": {
      const n = Number(settings.number) || 1;
      const frame = status?.frames?.[n - 1];
      return frame ? { op: "go_live", args: { frame: frame.id } } : null;
    }
    default:
      return null;
  }
}

/** Which state a key shows (0 off, 1 on), or null for keys without states. */
export function stateFor(kind, status, settings = {}) {
  if (!status) return 0;
  if (kind === "blackout") return status.blackout ? 1 : 0;
  if (kind === "question") return status.question ? 1 : 0;
  if (kind === "scripture") return status.scripture ? 1 : 0;
  if (kind === "golive") {
    const frame = status.frames?.[(Number(settings.number) || 1) - 1];
    return frame && status.frame?.id === frame.id ? 1 : 0;
  }
  return null;
}

/** The Go Live key's title: the Frame's number and the start of its name. */
export function goLiveTitle(status, settings = {}) {
  const n = Number(settings.number) || 1;
  const frame = status?.frames?.[n - 1];
  if (!frame) return `${n}\n—`;
  const name = frame.name.length > 9 ? `${frame.name.slice(0, 8)}…` : frame.name;
  return `${n}\n${name}`;
}
