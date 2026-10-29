"use client";

import { useRouter } from "next/navigation";

import { readGuide, writeGuide } from "@/lib/guide-steps";

/** Help → "Show the Setup guide": brings the guide back on Home after it was hidden. */
export function ShowGuide() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="fd-btn fd-btn-ghost fd-btn-sm"
      onClick={() => {
        writeGuide(localStorage, { ...readGuide(localStorage), hidden: false });
        router.push("/");
      }}
    >
      Show the Setup guide on Home
    </button>
  );
}
