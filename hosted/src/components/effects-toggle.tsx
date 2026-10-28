"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

// "Reduce effects": stops every gentle loop on the website (drifting light, marquee, light beam, teleprompter) for
// people who keep the website open next to the program on an older PC. layout.tsx applies the saved choice before the
// first paint (html.fd-calm); the device's own "reduce motion" setting does the same without this button.
const KEY = "fd-effects";

export function EffectsToggle() {
  const [calm, setCalm] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCalm(document.documentElement.classList.contains("fd-calm"));
  }, []);

  function change() {
    const next = !calm;
    try {
      if (next) localStorage.setItem(KEY, "calm");
      else localStorage.removeItem(KEY);
    } catch {
      /* private window: the choice lasts for this page only */
    }
    document.documentElement.classList.toggle("fd-calm", next);
    setCalm(next);
  }

  const label = calm ? "Effects reduced: the website keeps still" : "Effects on";
  return (
    <button
      className="fd-theme-toggle fd-effects-toggle"
      type="button"
      onClick={change}
      aria-pressed={calm}
      aria-label={`Reduce effects${calm ? ": on" : ": off"}`}
      title={label}
    >
      <Sparkles aria-hidden="true" size={16} />
    </button>
  );
}
