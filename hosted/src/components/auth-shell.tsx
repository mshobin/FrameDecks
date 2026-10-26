import Image from "next/image";
import Link from "next/link";

export function AuthShell({
  eyebrow,
  title,
  children,
}: Readonly<{ eyebrow: string; title: string; children: React.ReactNode }>) {
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <Link className="auth-brand" href="/" aria-label="FRAMEDECKS overview">
          <Image src="/framedecks-emblem.webp" alt="" width={44} height={44} priority unoptimized />
          <strong>FRAMEDECKS</strong>
        </Link>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {children}
      </section>
      <p className="auth-footnote">
        Your presentation stays on your service PC. This account is only for the hosted companion.
        {" "}
        <Link href="/privacy">Privacy</Link>
      </p>
    </main>
  );
}
