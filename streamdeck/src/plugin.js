// FRAMEDECKS for Stream Deck: keys that run FRAMEDECKS actions exactly like its keyboard shortcuts, even while Zoom or
// Teams has the focus. Each press goes to the FRAMEDECKS program on this PC (src/framedecks.js), which hands it to its
// own window to run with the keys' code. Toggle keys and Go Live keys light up to match what is on screen.
import streamDeck, { SingletonAction } from "@elgato/streamdeck";

import { FrameDecks, commandFor, goLiveTitle, stateFor } from "./framedecks.js";

const fd = new FrameDecks();
const PLUGIN = "com.framedecks.control";
const kinds = ["next", "previous", "golive", "hideall", "blackout", "question", "scripture"];
const visible = new Map(); // action id -> {action, kind}
let status = null;
let timer = null;

async function refresh() {
  try {
    status = await fd.status();
  } catch {
    status = null;
  }
  for (const { action, kind } of visible.values()) {
    if (!action.isKey()) continue;
    const settings = (await action.getSettings()) || {};
    const state = stateFor(kind, status, settings);
    if (state !== null) await action.setState(state);
    if (kind === "golive") await action.setTitle(goLiveTitle(status, settings));
  }
}

// Ask what is on screen once a second, only while a FRAMEDECKS key is visible on a Stream Deck
function watch() {
  if (visible.size && !timer) timer = setInterval(refresh, 1000);
  if (!visible.size && timer) {
    clearInterval(timer);
    timer = null;
  }
}

class FrameDecksKey extends SingletonAction {
  constructor(kind) {
    super();
    this.kind = kind;
    this.manifestId = `${PLUGIN}.${kind}`;
  }

  async onWillAppear(ev) {
    visible.set(ev.action.id, { action: ev.action, kind: this.kind });
    watch();
    await refresh();
  }

  onWillDisappear(ev) {
    visible.delete(ev.action.id);
    watch();
  }

  async onDidReceiveSettings() {
    await refresh();
  }

  async onKeyDown(ev) {
    try {
      const now = await fd.status();
      const cmd = commandFor(this.kind, now, ev.payload.settings || {});
      if (!cmd) return void (await ev.action.showAlert());
      const answer = await fd.run(cmd.op, cmd.args);
      if (!answer.ok) {
        streamDeck.logger.warn(`${cmd.op}: ${answer.result}`);
        await ev.action.showAlert();
      }
    } catch (e) {
      streamDeck.logger.warn(String(e));
      await ev.action.showAlert(); // FRAMEDECKS is not running
    }
    await refresh();
  }
}

for (const kind of kinds) streamDeck.actions.registerAction(new FrameDecksKey(kind));
streamDeck.connect();
