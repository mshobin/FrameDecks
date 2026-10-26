import Image from "next/image";
import Link from "next/link";

import { BrandMark, MISSION } from "@/components/brand-hero";
import { Workflow } from "@/components/workflow";

/** Sign-in and its return page: the brand and how FRAMEDECKS works beside a glass card. `document` is the single
 * column the privacy policy uses. */
export function AuthShell({
  eyebrow,
  title,
  children,
  document = false,
}: Readonly<{ eyebrow: string; title: string; children: React.ReactNode; document?: boolean }>) {
  const card = (
    <section className={document ? "fd-auth-card fd-auth-doc" : "fd-auth-card"}>
      {document && (
        <Link className="fd-brand fd-auth-brandline" href="/" aria-label="FRAMEDECKS">
          <span className="fd-brand-mark">
            <Image src="/framedecks-emblem.webp" alt="" width={30} height={30} priority unoptimized />
          </span>
          <span className="fd-brand-copy">
            <strong>FRAMEDECKS</strong>
          </span>
        </Link>
      )}
      <p className="fd-kicker">{eyebrow}</p>
      <h1 className="fd-auth-title">{title}</h1>
      {children}
    </section>
  );
  const foot = (
    <p className="fd-auth-foot">
      Your presentation stays on your service PC. This account is only for the FRAMEDECKS website.{" "}
      <Link href="/privacy">Privacy</Link>
    </p>
  );
  if (document) {
    return (
      <div className="fd-auth fd-auth-single">
        {card}
        {foot}
      </div>
    );
  }
  return (
    <div className="fd-auth">
      <aside className="fd-auth-side">
        <Link href="/" aria-label="FRAMEDECKS home">
          <BrandMark size="medium" />
        </Link>
        <p className="fd-auth-mission">{MISSION}</p>
        <Workflow compact />
      </aside>
      <div className="fd-auth-main">
        {card}
        {foot}
      </div>
    </div>
  );
}
