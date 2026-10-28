import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { BrandingPanel } from "@/components/branding-panel";
import { PRIVATE_PAGE } from "@/lib/site";

export const metadata: Metadata = { title: "Branding", ...PRIVATE_PAGE };

export default function BrandingPage() {
  return (
    <AppShell active="branding">
      <section className="page-head">
        <p className="eyebrow">WORKSPACE</p>
        <h1>Branding</h1>
      </section>
      <BrandingPanel />
    </AppShell>
  );
}
