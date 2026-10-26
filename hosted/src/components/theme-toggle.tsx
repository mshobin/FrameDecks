"use client";

import { useEffect, useState } from "react";
import { Moon, Sun, SunMoon } from "lucide-react";

// Auto (follow the device), Light or Dark (design audit DD-23). layout.tsx applies the saved choice before the first
// paint; this button changes it and, on Auto, follows the device when it switches.
type Choice = "auto" | "light" | "dark";
const KEY = "fd-theme";
const NEXT: Record<Choice, Choice> = { auto: "light", light: "dark", dark: "auto" };
const LABEL: Record<Choice, string> = { auto: "Theme: follows this device", light: "Theme: light", dark: "Theme: dark" };

function read(): Choice {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "auto";
  } catch {
    return "auto";
  }
}

function apply(choice: Choice) {
  const light = choice === "light" || (choice === "auto" && matchMedia("(prefers-color-scheme: light)").matches);
  document.documentElement.classList.toggle("fd-light", light);
}

export function ThemeToggle() {
  const [choice, setChoice] = useState<Choice>("auto");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChoice(read());
    const media = matchMedia("(prefers-color-scheme: light)");
    const follow = () => read() === "auto" && apply("auto");
    media.addEventListener("change", follow);
    return () => media.removeEventListener("change", follow);
  }, []);

  function change() {
    const next = NEXT[choice];
    try {
      if (next === "auto") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, next);
    } catch {
      /* private window: the choice lasts for this page only */
    }
    setChoice(next);
    apply(next);
  }

  const Icon = choice === "light" ? Sun : choice === "dark" ? Moon : SunMoon;
  return (
    <button className="fd-theme-toggle" type="button" onClick={change} aria-label={`${LABEL[choice]}. Change`} title={LABEL[choice]}>
      <Icon aria-hidden="true" size={16} />
    </button>
  );
}
