"use client";

// FrameDecks 26.11.38 - six boxes for the emailed code: typing moves on, Backspace moves back, a pasted or autofilled
// code fills them all, and the sixth digit sends it. One real input carries the phone's "code from Messages/Mail"
// autofill (autocomplete="one-time-code"); the boxes are what people see.
import { useRef } from "react";

import { CODE_LENGTH, codeDigits } from "@/lib/email-code";

export function CodeBoxes({ value, onChange, onComplete, disabled }: Readonly<{
  value: string;
  onChange: (digits: string) => void;
  onComplete: (digits: string) => void;
  disabled?: boolean;
}>) {
  const input = useRef<HTMLInputElement>(null);
  const set = (text: string) => {
    const digits = codeDigits(text);
    onChange(digits);
    if (digits.length === CODE_LENGTH) onComplete(digits);
  };
  return (
    <div className="ec-boxes" onClick={() => input.current?.focus()}>
      <input
        ref={input}
        id="email-code"
        className="ec-real"
        inputMode="numeric"
        autoComplete="one-time-code"
        aria-label="6-digit code from the email"
        maxLength={CODE_LENGTH + 4}
        value={value}
        disabled={disabled}
        autoFocus
        onChange={(e) => set(e.target.value)}
      />
      {Array.from({ length: CODE_LENGTH }, (_, i) => (
        <span key={i} aria-hidden="true" className={i === value.length ? "ec-box ec-at" : value[i] ? "ec-box ec-full" : "ec-box"}>
          {value[i] ?? ""}
        </span>
      ))}
    </div>
  );
}
