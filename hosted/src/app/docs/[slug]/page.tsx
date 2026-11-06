import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DocBody, PublicPage } from "@/components/public-page";
import { HelpVote } from "@/components/help-vote";
import { guidePage, guides } from "@/lib/markdown";
import { pageMetadata } from "@/lib/site";

export const dynamicParams = false;

export function generateStaticParams() {
  return guides().map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const g = guides().find((x) => x.slug === slug);
  return pageMetadata(g ? g.title : "Documentation", `/docs/${slug}`);
}

export default async function GuidePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const doc = guidePage(slug);
  if (!doc) notFound();
  return (
    <PublicPage eyebrow="Documentation" title={doc.title}>
      <p className="fd-crumbline">
        <Link href="/docs">All guides</Link>
      </p>
      <DocBody html={doc.html} />
      <HelpVote article={`docs/${slug}`} />
    </PublicPage>
  );
}
