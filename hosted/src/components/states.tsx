"use client";

import { RotateCw } from "lucide-react";

// The website's states (design audit DD-15): one way to show loading, nothing yet and a problem, everywhere.

/** Grey shapes where the page's cards will be, so the page doesn't jump when they arrive. */
export function PageSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <div className="fd-skeleton" aria-busy="true" aria-live="polite">
      <span className="fd-sr">Loading…</span>
      <div className="fd-skel fd-skel-line" style={{ width: "42%" }} />
      {Array.from({ length: cards }, (_, i) => (
        <div className="fd-skel fd-skel-card" key={i} />
      ))}
    </div>
  );
}

/** A few grey rows inside a card. */
export function ListSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <div className="fd-skeleton fd-skeleton-list" aria-busy="true" aria-live="polite">
      <span className="fd-sr">Loading…</span>
      {Array.from({ length: rows }, (_, i) => (
        <div className="fd-skel fd-skel-row" key={i} />
      ))}
    </div>
  );
}

/** Nothing here yet: a title, one sentence and at most one action. */
export function EmptyState({ title, children, action }: { title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="fd-empty">
      <h2>{title}</h2>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

/** Something went wrong: what happened, in words, and Try again. */
export function ErrorState({ text, onRetry }: { text: string; onRetry?: () => void }) {
  return (
    <div className="fd-error" role="alert">
      <p>
        <strong>That didn’t load.</strong> {text}
      </p>
      {onRetry && (
        <button className="fd-btn fd-btn-glass fd-btn-sm" type="button" onClick={onRetry}>
          <RotateCw aria-hidden="true" size={15} /> Try again
        </button>
      )}
    </div>
  );
}
