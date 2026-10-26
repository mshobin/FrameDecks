import { Fragment } from "react";

/** A headline whose words rise into place one after another when the page opens (CSS only; still readable as one
 * line by screen readers). The spaces sit between the words, so they never collapse. */
export function Words({ text, start = 120, step = 70 }: Readonly<{ text: string; start?: number; step?: number }>) {
  return (
    <span className="fd-words" aria-label={text}>
      {text.split(" ").map((word, i) => (
        <Fragment key={i}>
          {i > 0 && " "}
          <span className="fd-word" aria-hidden="true" style={{ "--d": `${start + i * step}ms` } as React.CSSProperties}>
            {word}
          </span>
        </Fragment>
      ))}
    </span>
  );
}
