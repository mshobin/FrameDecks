import type { Metadata } from "next";
import Link from "next/link";

import { PublicPage } from "@/components/public-page";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata("Contact", "/contact");

const WAYS = [
  {
    title: "Questions and help",
    mail: "hello@framedecks.com",
    text: "Anything about FrameDecks. Include Settings → Diagnostics → Copy diagnostics if something is not working.",
  },
  {
    title: "Privacy",
    mail: "privacy@framedecks.com",
    text: "See, export or delete your data, or ask how it is used.",
  },
  {
    title: "Complaints (Grievance Officer)",
    mail: "grievance@framedecks.com",
    text: "A complaint about FrameDecks or how your data is handled. We reply within 24 hours and aim to resolve it within 15 days.",
  },
  {
    title: "Security",
    mail: "security@framedecks.com",
    text: "Report a vulnerability privately. Please read the disclosure policy first.",
  },
];

export default function ContactPage() {
  return (
    <PublicPage
      eyebrow="Company"
      title="Contact"
      lead="A person reads every message. We aim to answer within two working days."
    >
      <ul className="fd-contact">
        {WAYS.map((w) => (
          <li key={w.mail}>
            <h2>{w.title}</h2>
            <a href={`mailto:${w.mail}`}>{w.mail}</a>
            <p>{w.text}</p>
          </li>
        ))}
      </ul>
      <p className="fd-public-note">
        In a hurry before a service? The <Link href="/help">Help Center</Link>{" "}
        has the answers volunteers need most, and Esc always clears the screen.
      </p>
    </PublicPage>
  );
}
