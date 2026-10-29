import type { Metadata } from "next";

import { PublicPage } from "@/components/public-page";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata("Roadmap", "/roadmap");

// What is coming, in plain words. Keep it to what is decided (docs/continuity/PROJECT_ROADMAP.md has the detail);
// dates are left out on purpose.
const LANES = [
  {
    title: "Recently released",
    items: [
      [
        "Updates that install themselves",
        "FrameDecks finds, checks and installs new versions, and can put the previous one back.",
      ],
      [
        "Setup guide",
        "Seven steps from install to your first gathering, each ticked when it is really done.",
      ],
      [
        "One-click linking",
        "Connect a PC to your workspace from the browser, with no code to type.",
      ],
    ],
  },
  {
    title: "Next",
    items: [
      [
        "Workspace looks",
        "Six designed looks for what the room and the stream see, chosen once on the website for every PC.",
      ],
      ["A signed installer", "No Windows warning when installing."],
    ],
  },
  {
    title: "Later",
    items: [
      ["FrameDecks for Mac and Linux", "The program on more computers."],
      [
        "Team plans",
        "More workspaces, more people and more cloud features for larger teams, alongside everything that is free today.",
      ],
      ["Run-through timer", "Practice once and see how long each part takes."],
      [
        "Take it home",
        "A page for the room with the night's verses and questions.",
      ],
    ],
  },
] as const;

export default function RoadmapPage() {
  return (
    <PublicPage
      eyebrow="Product"
      title="Roadmap"
      lead="What we are working on, and what comes after. Everything free today stays free."
    >
      <div className="fd-roadmap">
        {LANES.map((lane) => (
          <section key={lane.title} aria-labelledby={`rm-${lane.title}`}>
            <h2 id={`rm-${lane.title}`}>{lane.title}</h2>
            <ul>
              {lane.items.map(([t, d]) => (
                <li key={t}>
                  <strong>{t}</strong>
                  <span>{d}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </PublicPage>
  );
}
