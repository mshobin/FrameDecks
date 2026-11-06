"use client";

// FrameDecks 26.11.4 - "Was this helpful?" under every Help topic and guide page. Only the article and the vote are
// sent (supabase/migrations/0017_help_votes.sql: no person, no address); the answer is remembered in this browser so
// the question is not asked twice. A "No" offers to tell us what was missing. Hidden where the workspace is not set up.
import { useEffect, useState } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";

import { browserSupabase } from "@/lib/supabase-browser";
import "@/app/help-vote.css";

const CONTACT = "hello@framedecks.com";
const KEY = (a: string) => `fd-voted:${a}`;

export function HelpVote({ article }: Readonly<{ article: string }>) {
  const supabase = browserSupabase();
  const [voted, setVoted] = useState<"yes" | "no" | null>(null);

  useEffect(() => {
    let v: string | null = null;
    try {
      v = localStorage.getItem(KEY(article));
    } catch {
      v = null;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVoted(v === "yes" || v === "no" ? v : null);
  }, [article]);

  if (!supabase) return null;

  function vote(helpful: boolean) {
    const v = helpful ? "yes" : "no";
    setVoted(v);
    try {
      localStorage.setItem(KEY(article), v);
    } catch {
      /* private window: asked again next time */
    }
    void supabase?.rpc("help_vote", { article, helpful }).then(
      () => undefined,
      () => undefined,
    );
  }

  return (
    <div className="hv" role="group" aria-label="Was this helpful?">
      {voted === null ? (
        <>
          <span>Was this helpful?</span>
          <button type="button" onClick={() => vote(true)}>
            <ThumbsUp aria-hidden="true" size={15} /> Yes
          </button>
          <button type="button" onClick={() => vote(false)}>
            <ThumbsDown aria-hidden="true" size={15} /> No
          </button>
        </>
      ) : voted === "yes" ? (
        <span role="status">Thank you.</span>
      ) : (
        <span role="status">
          Thank you. What was missing?{" "}
          <a href={`mailto:${CONTACT}?subject=${encodeURIComponent(`Help page: ${article}`)}`}>Tell us in one line</a>, and we will improve it.
        </span>
      )}
    </div>
  );
}
