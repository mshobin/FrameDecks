import type { Metadata } from "next";
import Link from "next/link";

import { PublicPage } from "@/components/public-page";
import brand from "@/lib/brand.json";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata("About", "/about");

// The same words as the program's About screen (app/js/brand.js, through lib/brand.json), as a page of the website.
export default function AboutPage() {
  return (
    <PublicPage eyebrow="Company" title="About FrameDecks" lead={brand.intro}>
      <article className="fd-doc">
        <h2>Mission</h2>
        <p>{brand.mission}</p>
        <h2>Vision</h2>
        <p>{brand.vision}</p>
        <h2>Why FrameDecks</h2>
        <p>
          <strong>{brand.why.lead}</strong> {brand.why.text}
        </p>
        <ul>
          {brand.why.points.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
        <h2>What we value</h2>
        <ul>
          {brand.values.map((v) => (
            <li key={v.title}>
              <strong>{v.title}.</strong> {v.text}
            </li>
          ))}
        </ul>
        <h2>Who made it</h2>
        {brand.creator.story.map((s) => (
          <p key={s}>{s}</p>
        ))}
        <p>
          FrameDecks is made by <strong>{brand.creator.name}</strong>.{" "}
          {brand.disclaimer}
        </p>
        <h2>Our commitment</h2>
        <ul>
          {brand.commitment.points.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
        <p className="fd-serif">{brand.commitment.lines.join(" ")}</p>
        <p>
          Questions? <Link href="/contact">Contact us</Link>.
        </p>
      </article>
    </PublicPage>
  );
}
