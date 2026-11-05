"use client";

import dynamic from "next/dynamic";

/** 9.11.2 the finishing touches (the living hero, the progress line, button moments, the closing scene) load in the
 *  browser once the page is showing, so they never hold up its first picture or count against its 24 KB of styles. */
export const FlourishLater = dynamic(() => import("@/components/landing/flourish"), { ssr: false });
