import Image from "next/image";
import Link from "next/link";

import { AboutButton } from "@/components/about-dialog";
import { BrandMark } from "@/components/brand-hero";
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
    <div className="fd-auth-foot">
      <p>
        Your presentation stays on your service PC. This account is only for the FRAMEDECKS website.{" "}
        <Link href="/privacy">Privacy</Link>
      </p>
      <div className="fd-auth-about">
        <AboutButton label />
      </div>
    </div>
  );
  if (document) {
    return (
      <main className="fd-auth fd-auth-single" id="main" tabIndex={-1}>
        {card}
        {foot}
      </main>
    );
  }
  return (
    <div className="fd-auth">
      <aside className="fd-auth-side">
        <Link href="/" aria-label="FRAMEDECKS home">
          <BrandMark size="medium" />
        </Link>
        <Workflow compact />
      </aside>
      <main className="fd-auth-main" id="main" tabIndex={-1}>
        {card}
        {foot}
      </main>
    </div>
  );
}
