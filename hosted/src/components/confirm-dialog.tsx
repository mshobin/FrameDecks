"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

export type ConfirmationOptions = Readonly<{
  title: string;
  description: string;
  confirmLabel: string;
  tone?: "danger" | "primary";
  confirmationText?: string;
  confirmationLabel?: string;
}>;

/** A consistent, accessible confirmation dialog for actions that need an explicit second step. */
export function useConfirmation() {
  const [options, setOptions] = useState<ConfirmationOptions | null>(null);
  const resolve = useRef<((accepted: boolean) => void) | null>(null);

  const ask = useCallback((next: ConfirmationOptions) => {
    return new Promise<boolean>((done) => {
      resolve.current?.(false);
      resolve.current = done;
      setOptions(next);
    });
  }, []);

  const finish = useCallback((accepted: boolean) => {
    const done = resolve.current;
    resolve.current = null;
    setOptions(null);
    done?.(accepted);
  }, []);

  useEffect(
    () => () => {
      resolve.current?.(false);
      resolve.current = null;
    },
    [],
  );

  return {
    ask,
    dialog: <ConfirmationDialog options={options} onCancel={() => finish(false)} onConfirm={() => finish(true)} />,
  };
}

function ConfirmationDialog({
  options,
  onCancel,
  onConfirm,
}: Readonly<{
  options: ConfirmationOptions | null;
  onCancel: () => void;
  onConfirm: () => void;
}>) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [entry, setEntry] = useState<{ options: ConfirmationOptions; value: string } | null>(null);
  const id = useId();

  useEffect(() => {
    const element = dialog.current;
    if (options && element && !element.open) element.showModal();
    return () => {
      if (element?.open) element.close();
    };
  }, [options]);

  if (!options) return null;

  const needsText = Boolean(options.confirmationText);
  const typed = entry?.options === options ? entry.value : "";
  const canConfirm = !needsText || typed.trim() === options.confirmationText;

  return (
    <dialog
      ref={dialog}
      className="fd-confirm"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-description`}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      onClick={(event) => {
        if (event.target === dialog.current) onCancel();
      }}
    >
      <div className="fd-confirm-content">
        <h2 id={`${id}-title`}>{options.title}</h2>
        <p id={`${id}-description`}>{options.description}</p>
        {needsText && (
          <label className="fd-confirm-label" htmlFor={`${id}-confirmation`}>
            {options.confirmationLabel ?? "Type the name to confirm"}
            <input
              id={`${id}-confirmation`}
              autoComplete="off"
              value={typed}
              onChange={(event) => setEntry({ options, value: event.target.value })}
            />
          </label>
        )}
        <div className="fd-confirm-actions">
          <button className="fd-btn fd-btn-glass" type="button" autoFocus onClick={onCancel}>
            Cancel
          </button>
          <button
            className={`fd-btn fd-confirm-submit${options.tone === "primary" ? " fd-confirm-primary" : ""}`}
            type="button"
            disabled={!canConfirm}
            onClick={onConfirm}
          >
            {options.confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
