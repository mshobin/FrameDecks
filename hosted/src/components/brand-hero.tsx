import Image from "next/image";

export const TAGLINE = "Present · Equip · Inspire";

/** The emblem in its glow, the wordmark and the tagline: the brand as the FrameDecks header shows it. */
export function BrandMark({ size = "large" }: Readonly<{ size?: "large" | "medium" }>) {
  const px = size === "large" ? 132 : 92;
  return (
    <div className={`fd-mark fd-mark-${size}`}>
      <div className="fd-mark-glow" aria-hidden="true" />
      <Image className="fd-mark-emblem" src="/framedecks-emblem.webp" alt="FrameDecks emblem" width={px} height={px} priority unoptimized />
      <p className="fd-wordmark">FrameDecks</p>
      <p className="fd-tagline">{TAGLINE}</p>
    </div>
  );
}
