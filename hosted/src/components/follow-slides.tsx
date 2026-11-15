"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

/** 26.11.48 Members' phones and PowerPoint slides (0025_room_slides.sql): the slides already shown on the meeting screen
 * (never the ones still to come), each with a sharp picture fetched by its number, to zoom into with two fingers, to swipe
 * back through, and to keep with the sermon notes. When 0025 is not in the database yet, nothing here shows and the phone
 * keeps the small picture of the slide on screen. */
export type ShownSlide = { page: number; title: string; body: string };

const JPEG = "data:image/jpeg;base64,";

function tidy(rows: unknown): ShownSlide[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((r) => r as { page?: unknown; title?: unknown; body?: unknown })
    .filter((r) => Number.isInteger(r.page))
    .slice(0, 300)
    .map((r) => ({ page: Number(r.page), title: String(r.title ?? "").slice(0, 120), body: String(r.body ?? "").slice(0, 600) }));
}

/** The slides shown so far in this room, looked at again whenever the slide on screen changes (`key`), and their sharp
 * pictures, each fetched once (the slide on screen again when it changes: an animation adds to it). */
export function useShownSlides(supabase: SupabaseClient | null, code: string | null, key: string, current: number | null) {
  const [list, setList] = useState<ShownSlide[] | null>(null); // null: not available here (no 0025, or no code)
  const pics = useRef(new Map<number, string>());
  useEffect(() => {
    if (!supabase || !code) return;
    if (current !== null) pics.current.delete(current);
    let gone = false;
    void supabase.rpc("room_slides", { code }).then(({ data, error }) => {
      if (gone) return;
      const d = (data ?? {}) as { status?: string; slides?: unknown };
      setList(error || d.status !== "open" ? null : tidy(d.slides));
    });
    return () => {
      gone = true;
    };
  }, [supabase, code, key, current]);
  const picture = useCallback(
    async (page: number): Promise<string | null> => {
      const have = pics.current.get(page);
      if (have) return have;
      if (!supabase || !code) return null;
      const { data, error } = await supabase.rpc("room_slide", { code, page });
      const d = (data ?? {}) as { status?: string; img?: unknown };
      if (error || d.status !== "open" || typeof d.img !== "string" || !d.img.startsWith(JPEG)) return null;
      pics.current.set(page, d.img);
      return d.img;
    },
    [supabase, code],
  );
  return { list, picture };
}

/** One slide's sharp picture, fetched when it is drawn (the handout in the sermon notes) */
export function SlidePicture({ page, label, picture }: Readonly<{ page: number; label: string; picture: (p: number) => Promise<string | null> }>) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let gone = false;
    void picture(page).then((s) => {
      if (!gone) setSrc(s);
    });
    return () => {
      gone = true;
    };
  }, [page, picture]);
  if (!src) return <div className="fl-pic-wait" aria-hidden="true" />;
  // eslint-disable-next-line @next/next/no-img-element -- a slide sent by the church PC as a data: picture
  return <img src={src} alt={label} />;
}

type View = { s: number; x: number; y: number };

/** The slide filling the phone: pinch or double-tap to zoom, drag to look around, swipe (or ◀ ▶) through the slides
 * already shown. Opens on the slide on screen; "Now" comes back to it. */
export function SlideViewer({
  slides,
  start,
  current,
  picture,
  small,
  onClose,
}: Readonly<{
  slides: ShownSlide[];
  start: number;
  current: number;
  picture: (p: number) => Promise<string | null>;
  small: string | null; // the small picture of the slide on screen (`current`), shown until the sharp one comes
  onClose: () => void;
}>) {
  const [i, setI] = useState(() => Math.max(0, slides.findIndex((x) => x.page === start)));
  const [src, setSrc] = useState<string | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const img = useRef<HTMLImageElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const view = useRef<View>({ s: 1, x: 0, y: 0 });
  const pts = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d: number; mx: number; my: number; v: View } | null>(null);
  const drag = useRef<{ x: number; y: number; vx: number; vy: number; t: number } | null>(null);
  const lastTap = useRef(0);
  const slide = slides[Math.min(i, slides.length - 1)];
  const page = slide?.page ?? start;

  const paint = useCallback((v: View) => {
    const el = stage.current;
    if (el) {
      const mx = ((v.s - 1) * el.clientWidth) / 2;
      const my = ((v.s - 1) * el.clientHeight) / 2;
      v.x = Math.max(-mx, Math.min(mx, v.x));
      v.y = Math.max(-my, Math.min(my, v.y));
    }
    view.current = v;
    if (img.current) img.current.style.transform = `translate(${v.x}px, ${v.y}px) scale(${v.s})`;
  }, []);

  useEffect(() => {
    let gone = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the small picture first, the sharp one when it comes
    setSrc(page === current ? small : null);
    paint({ s: 1, x: 0, y: 0 });
    void picture(page).then((s) => {
      if (!gone && s) setSrc(s);
    });
    return () => {
      gone = true;
    };
  }, [page, current, small, picture, paint]);

  const go = useCallback((by: number) => setI((n) => Math.max(0, Math.min(slides.length - 1, n + by))), [slides.length]);

  useEffect(() => {
    close.current?.focus();
    const keys = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
    };
    document.addEventListener("keydown", keys);
    const was = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", keys);
      document.body.style.overflow = was;
    };
  }, [go, onClose]);

  function down(e: ReactPointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const p = [...pts.current.values()];
    if (p.length === 2) {
      drag.current = null;
      pinch.current = { d: Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) || 1, mx: (p[0].x + p[1].x) / 2, my: (p[0].y + p[1].y) / 2, v: { ...view.current } };
    } else if (p.length === 1) {
      drag.current = { x: e.clientX, y: e.clientY, vx: view.current.x, vy: view.current.y, t: Date.now() };
    }
  }
  function move(e: ReactPointerEvent<HTMLDivElement>) {
    if (!pts.current.has(e.pointerId)) return;
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const p = [...pts.current.values()];
    const z = pinch.current;
    if (z && p.length >= 2) {
      const d = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
      const s = Math.max(1, Math.min(5, (z.v.s * d) / z.d));
      paint({ s, x: z.v.x + ((p[0].x + p[1].x) / 2 - z.mx), y: z.v.y + ((p[0].y + p[1].y) / 2 - z.my) });
    } else if (drag.current && view.current.s > 1) {
      paint({ s: view.current.s, x: drag.current.vx + e.clientX - drag.current.x, y: drag.current.vy + e.clientY - drag.current.y });
    }
  }
  function up(e: ReactPointerEvent<HTMLDivElement>) {
    pts.current.delete(e.pointerId);
    if (pts.current.size < 2) pinch.current = null;
    const d = drag.current;
    if (!d || pts.current.size) return;
    drag.current = null;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (view.current.s <= 1.01 && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) return go(dx < 0 ? 1 : -1);
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10 && Date.now() - d.t < 300) {
      const now = Date.now();
      if (now - lastTap.current < 320) {
        lastTap.current = 0;
        const el = stage.current?.getBoundingClientRect();
        if (view.current.s > 1.01 || !el) paint({ s: 1, x: 0, y: 0 });
        else paint({ s: 2.5, x: (el.left + el.width / 2 - e.clientX) * 1.5, y: (el.top + el.height / 2 - e.clientY) * 1.5 });
      } else lastTap.current = now;
    }
  }

  const label = slide?.title ? `Slide ${page + 1}: ${slide.title}` : `Slide ${page + 1}`;
  return (
    <div className="fl-view" role="dialog" aria-modal="true" aria-label={label}>
      <div className="fl-view-bar">
        <span className="fl-view-n">
          {label}
          {page === current ? <span className="fl-view-now">On screen</span> : null}
        </span>
        <button ref={close} type="button" className="fl-view-x" aria-label="Close" onClick={onClose}>
          ×
        </button>
      </div>
      <div ref={stage} className="fl-view-stage" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element -- the slide sent by the church PC as a data: picture
          <img ref={img} src={src} alt={label} draggable={false} />
        ) : (
          <p className="fl-quiet">{slide?.body || "This slide’s picture isn’t here."}</p>
        )}
      </div>
      <div className="fl-view-foot">
        <button type="button" onClick={() => go(-1)} disabled={i <= 0} aria-label="Earlier slide">
          ◀
        </button>
        <span>
          {slides.length > 1 ? `${i + 1} of ${slides.length} shown` : "Pinch or double-tap to zoom"}
        </span>
        {page !== current && slides.some((x) => x.page === current) && (
          <button type="button" className="fl-view-nowbtn" onClick={() => setI(slides.findIndex((x) => x.page === current))}>
            Now
          </button>
        )}
        <button type="button" onClick={() => go(1)} disabled={i >= slides.length - 1} aria-label="Later slide">
          ▶
        </button>
      </div>
    </div>
  );
}
