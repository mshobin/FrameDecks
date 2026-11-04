import Image from "next/image";
import Link from "next/link";

import { AboutButton } from "@/components/about-dialog";
import { BrandMark } from "@/components/brand-hero";

/** Sign-in and its return page: the brand and how FrameDecks works beside a glass card. `document` is the single
 * column the privacy policy uses. */
export function AuthShell({
  eyebrow,
  title,
  children,
  document = false,
}: Readonly<{ eyebrow?: string; title?: string; children: React.ReactNode; document?: boolean }>) {
  const card = (
    <section className={document ? "fd-auth-card fd-auth-doc" : "fd-auth-card"}>
      {document && (
        <Link className="fd-brand fd-auth-brandline" href="/" aria-label="FrameDecks">
          <span className="fd-brand-mark">
            <Image src="/framedecks-emblem.webp" alt="" width={30} height={30} priority unoptimized />
          </span>
          <span className="fd-brand-copy">
            <strong>FrameDecks</strong>
          </span>
        </Link>
      )}
      {eyebrow && <p className="fd-kicker">{eyebrow}</p>}
      {title && <h1 className="fd-auth-title">{title}</h1>}
      {children}
    </section>
  );
  const foot = (
    <div className="fd-auth-foot">
      <p>
        Your presentation stays on your service PC. Your workspace is only for the FrameDecks website.{" "}
        <Link href="/terms">Terms</Link> · <Link href="/privacy">Privacy</Link>
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
        <Link href="/" aria-label="FrameDecks home">
          <BrandMark size="medium" />
        </Link>
        {/* One real screen and one sentence (owner-approved, 27 October), not a second copy of How it works */}
        <figure className="fd-auth-shot">
          <Image src="/product/live-phone.webp" alt="The Live page on a phone: Previous, Next, Hide all and Black screen" width={390} height={844} unoptimized />
          <figcaption>Plan here. Present on your service PC. Guide it from your phone.</figcaption>
        </figure>
      </aside>
      <main className="fd-auth-main" id="main" tabIndex={-1}>
        {card}
        {foot}
      </main>
    </div>
  );
}
