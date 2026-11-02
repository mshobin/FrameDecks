// FrameDecks 8.4 - the step-by-step guide on the Help page (components/help-guide.tsx), for the website and for the
// service PC, in the core order: sign in, a meeting, Frames, scripts, transitions and drawing, preview, sync or
// export, the service. Each step points at a screenshot (public/help/<shot>.jpg) and a highlighted place on it
// (src/lib/help-shots.json), both made by tests/visual/help-shots.mjs from the real screens.
//
// Kept true by tests/help-guide.test.mjs: every label in `ui` must appear in the website's or the program's code, every
// shot and highlight must exist. When a workflow changes, change the step here and run the screenshot script again.
// Self-contained (no imports), so the test loads it with Node's type stripping.

export type GuideTrack = "website" | "pc";
export type GuideStep = {
  id: string;
  core: number; // 1-8: sign in, meeting, Frames, script, transitions/drawing, preview, sync/export, the service
  title: string;
  why: string; // what it does, in one or two sentences
  steps: string[]; // numbered actions; **bold** = the label on screen
  ui: string[]; // labels exactly as on screen (checked against the code)
  shot: string; // public/help/<shot>.jpg
  spot: string; // the highlighted place on the shot (help-shots.json)
  tip?: string;
  caption?: string; // under the picture; default "Click <first label> then <second>"
};

export const CORE = [
  "Sign in",
  "Create a meeting",
  "Add Frames",
  "Write or upload scripts",
  "Transitions and drawing",
  "Preview",
  "Sync, export or import",
  "Run the meeting",
];

export const GUIDE: Record<GuideTrack, { title: string; lead: string; steps: GuideStep[] }> = {
  website: {
    title: "On the website",
    lead: "Plan the meeting from any computer, tablet or phone. Nothing here needs the service PC to be switched on.",
    steps: [
      {
        id: "web-sign-in",
        core: 1,
        title: "Sign in",
        why: "Your account keeps your workspace: the meetings, the Frames and the people in your team.",
        steps: ["Open framedecks.com and choose **Sign in**.", "Type your email and choose **Email me a sign-in link**.", "Open the email and tap the link. You are signed in on this device."],
        ui: ["Sign in", "Email me a sign-in link"],
        caption: "Email me a sign-in link",
        shot: "web-sign-in",
        spot: "send",
        tip: "Google or Microsoft buttons appear when your workspace has them switched on.",
      },
      {
        id: "web-meeting",
        core: 2,
        title: "Create your meeting",
        why: "The name, date and notes the whole team sees. The name also shows on the service PC.",
        steps: ["Choose **Plan** in the menu.", "Choose **Edit details** (step 1).", "Type the **Meeting name**, pick the **Date** and add any **Meeting notes**.", "Choose **Save details**. A green tick says it is saved."],
        ui: ["Plan", "Edit details", "Meeting name", "Date", "Meeting notes", "Save details"],
        shot: "web-meeting",
        spot: "form",
      },
      {
        id: "web-frames",
        core: 3,
        title: "Add Frames",
        why: "A Frame is one part of the meeting: a welcome, a reading, a discussion. People see one Frame at a time.",
        steps: ["Choose **Add Frame** (step 2, or the dashed tile at the end of the timeline).", "Give it a **Frame name**.", "Under Content, choose what it shows (a question, a scripture, text, a picture) and choose **Add Content**.", "Choose **Add Frame** at the bottom to save it."],
        ui: ["Add Frame", "Frame name", "Add Content"],
        shot: "web-steps",
        spot: "frames",
        tip: "Drag a Frame on the timeline to move it, or select it and press Alt + ← or →.",
      },
      {
        id: "web-script",
        core: 4,
        title: "Write the script",
        why: "What you will say while that Frame is on screen. Only the presenter sees it, in the Teleprompter.",
        steps: ["On a Frame, choose **Write Script**.", "Type what you want to say. Use # for a heading and - for a bullet.", "Choose **Save**."],
        ui: ["Write Script", "Save"],
        shot: "web-editor",
        spot: "script",
        tip: "To use a Word or text file, open the Teleprompter on the service PC and choose ⇪ Upload (Service PC step 4).",
      },
      {
        id: "web-animation",
        core: 5,
        title: "Choose an animation",
        why: "How the Frame appears when it goes on screen. Point at a button to see its movement.",
        steps: ["On a Frame, choose **Choose Animation**.", "Pick one: **Fade**, **Slide**, **Burst** and others. **Meeting style** uses the meeting's own.", "Choose **Save**."],
        ui: ["Choose Animation", "Fade", "Slide", "Burst", "Meeting style"],
        shot: "web-animation",
        spot: "picker",
        tip: "Drawing and the Spotlight are done live on the service PC (Service PC step 5).",
      },
      {
        id: "web-preview",
        core: 6,
        title: "Preview the meeting",
        why: "See each Frame roughly as people will, with its animation and your script underneath.",
        steps: ["Choose **Preview** (step 4, or on any Frame).", "Use **Next** and **Previous**, or the arrow keys.", "Close it with ✕ or Esc."],
        ui: ["Preview", "Next", "Previous"],
        caption: "The Preview: the Frame, its animation and your script",
        shot: "web-preview",
        spot: "stage",
      },
      {
        id: "web-send",
        core: 7,
        title: "Sync or export",
        why: "A linked service PC gets every change by itself within a minute. Without internet there, take a .frame file.",
        steps: ["Look at step 5: **Synced** means the website has your changes.", "For a PC without internet, choose **Export for Service PC**. A .frame file is saved.", "Copy it to the service PC (a USB stick is fine)."],
        ui: ["Synced", "Export for Service PC"],
        caption: "Export for Service PC is in step 5, under the Sync status",
        shot: "web-steps",
        spot: "send",
        tip: "Pictures you chose on this website travel inside the .frame file. Files only on the PC stay there.",
      },
      {
        id: "web-link",
        core: 8,
        title: "Link the service PC",
        why: "Once, so the PC follows the plan by itself. Only owners and admins can allow a PC.",
        steps: ["On the service PC, choose **Connect to FrameDecks** (Service PC step 1).", "Your browser opens: choose the workspace and **Allow**.", "The PC now appears under **Service PCs** here."],
        ui: ["Connect to FrameDecks", "Allow", "Service PCs"],
        caption: "Service PCs, in the menu",
        shot: "web-steps",
        spot: "nav",
      },
    ],
  },
  pc: {
    title: "On the service PC",
    lead: "The FrameDecks program runs the meeting: in Zoom or Teams, on a projector or in OBS, with or without internet.",
    steps: [
      {
        id: "pc-link",
        core: 1,
        title: "Install and link",
        why: "Install from framedecks.com/download. Linking to your workspace brings in everything planned on the website.",
        steps: ["Open FrameDecks and choose **Settings**, then **FrameDecks account**.", "Choose **Connect to FrameDecks**. Your browser opens.", "Sign in, choose the workspace and **Allow**. The page turns to Synced by itself."],
        ui: ["Settings", "FrameDecks account", "Connect to FrameDecks"],
        shot: "pc-account",
        spot: "connect",
        tip: "Linking is optional. A PC without internet uses a .frame file instead (step 7).",
      },
      {
        id: "pc-meeting",
        core: 2,
        title: "Start a meeting",
        why: "A linked PC already has the meeting from the website. To start one here, the Setup guide makes a ready set of Frames.",
        steps: ["The first time, the **Setup guide** asks what kind of gathering you lead.", "Choose one, for example **Bible Study**. Its Frames appear on the left.", "The meeting's name and logo are in **Settings** → **Meeting & Branding**."],
        ui: ["Setup guide", "Bible Study", "Meeting & Branding"],
        caption: "The Setup guide: choose the kind of gathering",
        shot: "pc-studio",
        spot: "guide",
      },
      {
        id: "pc-frames",
        core: 3,
        title: "Add Frames",
        why: "Each Frame is one part of the meeting. The list on the left is the order they go on screen.",
        steps: ["In **Studio**, choose **+ Frame** above the list.", "Pick a kind of Frame, or an empty one.", "Add what it shows with **+ Content** under Decks."],
        ui: ["Studio", "Frame", "Content"],
        shot: "pc-studio",
        spot: "add",
        tip: "Drag Frames in the list to change the order.",
      },
      {
        id: "pc-script",
        core: 4,
        title: "Write or upload the script",
        why: "The Teleprompter shows your script in a window only you see, over Zoom or Teams. It is never shared.",
        steps: ["Open **Live tools**, then **Teleprompter** (or press R).", "Move the pointer to the top: the bar appears.", "Choose **✎ Write Script** to type, or **⇪ Upload** for a .txt, .md or Word file.", "Choose **Each Frame** or **Whole meeting** for one script per Frame or one for all."],
        ui: ["Live tools", "Teleprompter", "Write Script", "Upload", "Each Frame", "Whole meeting"],
        shot: "pc-teleprompter",
        spot: "bar",
      },
      {
        id: "pc-transitions",
        core: 5,
        title: "Transitions and drawing",
        why: "The transition is how the next Frame arrives. Drawing marks the live picture; the Spotlight circles one word.",
        steps: ["Pick the **Transition** at the top for the next Frame (Frame default uses each Frame's own).", "During the meeting, choose **Draw on the picture** (or press D).", "Choose the Spotlight tool (S) and click a word, or press Ctrl twice."],
        ui: ["Transition", "Frame default", "Draw on the picture"],
        caption: "The Transition for the next Frame, at the top",
        shot: "pc-bar",
        spot: "transition",
      },
      {
        id: "pc-preview",
        core: 6,
        title: "Preview",
        why: "The Studio Canvas shows the selected Frame before it goes on screen. Nobody else sees it.",
        steps: ["Choose a Frame in the list.", "It shows in the **Studio Canvas** with the word **Preview**.", "For the full picture people get, open the **Share Window**."],
        ui: ["Studio Canvas", "Preview", "Share Window"],
        caption: "The Studio Canvas shows the selected Frame",
        shot: "pc-studio",
        spot: "canvas",
      },
      {
        id: "pc-sync",
        core: 7,
        title: "Sync, or import a .frame file",
        why: "A linked PC syncs every minute by itself. Resync gets the latest now. A .frame file brings a plan without internet.",
        steps: ["Choose the status button at the top right, then **Sync**, then **Resync Linked PCs**. It says **Sync complete** or **No changes found**.", "Without internet: **Settings** → **Data / Backup** → **Import Frame File…**.", "Choose the file, then **Use this plan**. A check confirms everything matches."],
        ui: ["Resync Linked PCs", "Sync complete", "No changes found", "Data / Backup", "Import Frame File…", "Use this plan"],
        caption: "Settings → Data / Backup → Frame files: Import Frame File…",
        shot: "pc-import",
        spot: "import",
        tip: "Use this plan makes a backup of your Frames first.",
      },
      {
        id: "pc-run",
        core: 8,
        title: "Run the meeting",
        why: "Go Live puts the selected Frame on screen; Next moves through the meeting.",
        steps: ["Choose the first Frame and **Go Live** (T).", "Use **Next** to move on. The phone remote works too.", "**Hide all** (Esc) clears the screen at any moment."],
        ui: ["Go Live", "Next", "Hide all"],
        shot: "pc-bar",
        spot: "golive",
      },
    ],
  },
};

/** The steps whose words match a search ("export", "teleprompter"), in either track. */
export function searchGuide(query: string): { track: GuideTrack; step: GuideStep }[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const out: { track: GuideTrack; step: GuideStep }[] = [];
  for (const track of ["website", "pc"] as GuideTrack[])
    for (const step of GUIDE[track].steps) {
      const text = [step.title, step.why, ...step.steps, ...step.ui, step.tip ?? "", CORE[step.core - 1]].join(" ").toLowerCase();
      if (words.every((w) => text.includes(w))) out.push({ track, step });
    }
  return out;
}
