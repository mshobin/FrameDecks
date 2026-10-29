"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, ImageIcon } from "lucide-react";

import { NotSetUp, WorkspaceGate } from "@/components/workspace-gate";
import { browserSupabase } from "@/lib/supabase-browser";
import { userSafeError } from "@/lib/user-error";
import {
  pullWorkspace,
  pushRecord,
  syncNotSetUp,
  type PulledRecord,
} from "@/lib/workspace-sync";
import type { WorkspaceChoice } from "@/lib/use-workspaces";
import {
  DEFAULT_GOLD,
  LOOKS,
  SWATCHES,
  brandFormOf,
  brandFromForm,
  hasLogo,
  labelColour,
  lookBody,
  lookOf,
  validColor,
  type BrandForm,
  type Look,
} from "@/lib/workspace-settings";
import { ErrorState, PageSkeleton } from "@/components/states";

type Loaded =
  | { record: PulledRecord | null; look: PulledRecord | null }
  | "not-set-up"
  | { error: string };

// Meeting & Branding, as in the program's Settings (app/js/meeting-brand.js): the synced "brand" record. The logo is
// a picture, so it is chosen on the service PC; everything else can be set here and reaches the PC within a minute.
function Branding({ workspace }: Readonly<{ workspace: WorkspaceChoice }>) {
  const supabase = browserSupabase();
  const canEdit = workspace.role === "owner" || workspace.role === "admin";
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [form, setForm] = useState<BrandForm>({
    meeting: "",
    org: "",
    color: "",
    auto: false,
  });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [lookNotice, setLookNotice] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    const { records, error } = await pullWorkspace(supabase, workspace.id);
    if (error)
      return setLoaded(
        syncNotSetUp(error)
          ? "not-set-up"
          : {
              error: userSafeError(
                error,
                "Couldn’t load your branding. Check your connection and try again.",
              ),
            },
      );
    const record =
      records.find((r) => r.kind === "brand" && r.id === "brand") ?? null;
    const look =
      records.find(
        (r) => r.kind === "layout" && r.id === "look" && !r.deleted,
      ) ?? null;
    setLoaded({ record, look });
    setForm(brandFormOf(record?.body));
  }, [supabase, workspace.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  if (loaded === null) return <PageSkeleton />;
  if (loaded === "not-set-up") return <NotSetUp />;
  if ("error" in loaded)
    return <ErrorState text={loaded.error} onRetry={load} />;
  const record = loaded.record;
  const lookRecord = loaded.look;
  const current = lookOf(lookRecord?.body);
  const chosen = LOOKS.find((l) => l.id === current);

  async function save() {
    if (!supabase || !validColor(form.color)) return;
    setBusy(true);
    setNotice(null);
    const base = record ?? {
      kind: "brand" as const,
      id: "brand",
      rev: 0,
      seq: 0,
      body: null,
    };
    const body = brandFromForm(form, record?.body);
    const answer = await pushRecord(supabase, workspace.id, base, body);
    setBusy(false);
    if (answer.status === "ok") {
      setLoaded({
        record: {
          ...base,
          kind: "brand",
          body: body as PulledRecord["body"],
          rev: answer.rev,
        },
        look: lookRecord,
      });
      setNotice({
        ok: true,
        text: "Branding saved. The service PC picks it up within about a minute.",
      });
    } else if (answer.status === "conflict") {
      setNotice({
        ok: false,
        text: "Branding was changed on the PC meanwhile. Here is the latest; make your change again.",
      });
      await load();
    } else setNotice({ ok: false, text: answer.message });
  }

  // 7.1 a look is the card surface and scripture font (layout/look) plus its accent (the brand colour): both are saved
  // together; the PCs change once nothing is on screen.
  async function chooseLook(look: Look) {
    if (!supabase || !canEdit) return;
    setBusy(true);
    setLookNotice(null);
    const lookBase = lookRecord ?? {
      kind: "layout" as const,
      id: "look",
      rev: 0,
      seq: 0,
      body: null,
    };
    const first = await pushRecord(
      supabase,
      workspace.id,
      lookBase,
      lookBody(look),
    );
    if (first.status !== "ok") {
      setBusy(false);
      if (first.status === "conflict") {
        setLookNotice({
          ok: false,
          text: "The look was changed somewhere else meanwhile. Here is the latest; choose again.",
        });
        await load();
      } else setLookNotice({ ok: false, text: first.message });
      return;
    }
    const nextForm = { ...form, color: look.accent };
    const brandBase = record ?? {
      kind: "brand" as const,
      id: "brand",
      rev: 0,
      seq: 0,
      body: null,
    };
    const brandBody = brandFromForm(nextForm, record?.body);
    const second = await pushRecord(
      supabase,
      workspace.id,
      brandBase,
      brandBody,
    );
    setBusy(false);
    setForm(nextForm);
    if (second.status === "ok") {
      setLoaded({
        record: {
          ...brandBase,
          kind: "brand",
          body: brandBody as PulledRecord["body"],
          rev: second.rev,
        },
        look: {
          ...lookBase,
          kind: "layout",
          body: lookBody(look) as PulledRecord["body"],
          rev: first.rev,
        },
      });
      setLookNotice({
        ok: true,
        text: `${look.name} is your workspace look. Each linked PC changes within about a minute, once nothing is on its screen.`,
      });
    } else {
      setLookNotice({
        ok: false,
        text: "The look is saved, but its accent colour could not be. Choose the look again.",
      });
      await load();
    }
  }

  const accent = form.color || DEFAULT_GOLD;
  const surface = chosen
    ? ({ "--surf-a": chosen.a, "--surf-b": chosen.b } as React.CSSProperties)
    : {};
  return (
    <div className="fd-settings-grid">
      <div className="fd-settings-col">
        <section className="workspace-card fd-settings-card" data-reveal>
          <h2>Look</h2>
          <p className="workspace-hint">
            How the cards look to the room and the stream: their colour, edge
            and scripture font. Every linked PC changes to it, once nothing is
            on its screen, so a look never changes mid-sentence.
          </p>
          <div
            className="fd-looks"
            role="radiogroup"
            aria-label="Workspace look"
          >
            {LOOKS.map((l) => (
              <button
                key={l.id}
                type="button"
                role="radio"
                aria-checked={current === l.id}
                disabled={!canEdit || busy}
                className="fd-look"
                onClick={() => chooseLook(l)}
              >
                <span
                  className="fd-look-mini"
                  aria-hidden="true"
                  style={
                    {
                      "--a": l.a,
                      "--b": l.b,
                      "--accent": l.accent || DEFAULT_GOLD,
                      "--label": labelColour(l.accent),
                    } as React.CSSProperties
                  }
                >
                  <i style={{ width: "40%" }} />
                  <i />
                </span>
                <strong>{l.name}</strong>
                <small>{l.feel}</small>
              </button>
            ))}
          </div>
          {lookNotice && (
            <p
              className={
                lookNotice.ok ? "workspace-notice" : "workspace-problem"
              }
              role={lookNotice.ok ? "status" : "alert"}
            >
              {lookNotice.text}
            </p>
          )}
          <span className="workspace-hint">
            {chosen
              ? `Now: ${chosen.name}. `
              : "Now: the standard look (Gold & Navy). "}
            A look also sets the accent colour; you can choose another one
            below.
          </span>
        </section>

        <section className="workspace-card fd-settings-card" data-reveal>
          <h2>Meeting & Branding</h2>
          <p className="workspace-hint">
            Your meeting&apos;s name and colour. They appear only where you
            choose: Branding Content, and text Content that asks for them.
          </p>
          <label className="fd-field">
            Meeting Name
            <input
              value={form.meeting}
              maxLength={80}
              disabled={!canEdit}
              placeholder="e.g. Tuesday Evening Bible Study"
              onChange={(e) => setForm({ ...form, meeting: e.target.value })}
            />
          </label>
          <label className="fd-field">
            Leader or organization
            <input
              value={form.org}
              maxLength={80}
              disabled={!canEdit}
              placeholder="e.g. New Life Fellowship · Mary Thomas"
              onChange={(e) => setForm({ ...form, org: e.target.value })}
            />
          </label>
          <div className="fd-field">
            Accent colour
            <div
              className="fd-swatches"
              role="radiogroup"
              aria-label="Accent colour"
            >
              {SWATCHES.map(([value, name]) => (
                <button
                  key={name}
                  type="button"
                  role="radio"
                  aria-checked={form.color === value}
                  aria-label={name}
                  title={name}
                  disabled={!canEdit}
                  className="fd-swatch"
                  style={{ background: value || DEFAULT_GOLD }}
                  onClick={() => setForm({ ...form, color: value })}
                >
                  {form.color === value && (
                    <Check aria-hidden="true" size={15} />
                  )}
                </button>
              ))}
              <label
                className="fd-swatch fd-swatch-custom"
                title="Another colour"
              >
                <input
                  type="color"
                  aria-label="Another colour"
                  disabled={!canEdit}
                  value={form.color || DEFAULT_GOLD}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                />
              </label>
            </div>
            <span className="workspace-hint">
              It replaces the gold of the question and scripture cards on
              screen.
            </span>
          </div>
          <label className="fd-check">
            <input
              type="checkbox"
              checked={form.auto}
              disabled={!canEdit}
              onChange={(e) => setForm({ ...form, auto: e.target.checked })}
            />
            New Frames include branding (Quick Start, Library, + Frame)
          </label>
          {notice && (
            <p
              className={notice.ok ? "workspace-notice" : "workspace-problem"}
              role={notice.ok ? "status" : "alert"}
            >
              {notice.text}
            </p>
          )}
          {canEdit ? (
            <div className="edit-actions">
              <button
                className="live-btn live-primary"
                type="button"
                disabled={busy}
                onClick={save}
              >
                {busy ? "Saving…" : "Save branding"}
              </button>
            </div>
          ) : (
            <p className="workspace-hint">
              View only: owners and admins can change branding.
            </p>
          )}
        </section>
      </div>

      <aside
        className="fd-settings-side"
        data-reveal
        style={{ "--d": "120ms" } as React.CSSProperties}
      >
        <p className="fd-kicker">Preview</p>
        <div
          className="fd-brand-preview"
          style={{ "--accent": accent } as React.CSSProperties}
        >
          <div className="fd-brand-badge">
            <span className="fd-brand-logo" aria-hidden="true">
              <ImageIcon size={18} />
            </span>
            <span>
              <strong>{form.meeting || "Meeting Name"}</strong>
              {form.org && <small>{form.org}</small>}
            </span>
          </div>
          <div
            className={chosen ? "fd-brand-card has-look" : "fd-brand-card"}
            style={surface}
          >
            <span className="fd-brand-label">Discussion question</span>
            <p>What does this passage reveal about the character of God?</p>
          </div>
        </div>
        <p className="workspace-hint">
          {hasLogo(record?.body)
            ? "Your logo is set on the service PC. To change it: FrameDecks → Settings → Meeting & Branding."
            : "Add a logo on the service PC: FrameDecks → Settings → Meeting & Branding (pictures stay on the PC)."}
        </p>
      </aside>
    </div>
  );
}

export function BrandingPanel() {
  return (
    <WorkspaceGate what="your branding">
      {(w) => <Branding key={w.id} workspace={w} />}
    </WorkspaceGate>
  );
}
