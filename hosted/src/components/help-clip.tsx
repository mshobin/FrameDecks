// FrameDecks 26.11.4 - short silent clips of the real program in the Help Center (tools/make_help_clips.py records
// them: public/help/clips/<name>.webp, a looping animated WebP, and <name>-still.webp). Anyone who asked for less
// motion (the system setting, or Reduce effects on this site) sees the still. Loaded only when scrolled near.
export type Clip = { name: string; title: string; caption: string; portrait?: boolean };

export function HelpClips({ clips }: Readonly<{ clips: Clip[] }>) {
  return (
    <div className="hc-clips">
      {clips.map((c) => (
        <figure key={c.name} className={`hc-clip${c.portrait ? " is-tall" : ""}`}>
          <picture>
            <source media="(prefers-reduced-motion: reduce)" srcSet={`/help/clips/${c.name}-still.webp`} />
            <img className="hc-clip-anim" src={`/help/clips/${c.name}.webp`} alt={c.caption} loading="lazy" decoding="async" />
          </picture>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="hc-clip-still" src={`/help/clips/${c.name}-still.webp`} alt="" aria-hidden="true" loading="lazy" decoding="async" />
          <figcaption>
            <b>{c.title}</b> {c.caption}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
