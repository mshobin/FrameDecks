"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, ImageIcon } from "lucide-react";

import { NotSetUp, WorkspaceGate } from "@/components/workspace-gate";
import { browserSupabase } from "@/lib/supabase-browser";
import { pullWorkspace, pushRecord, syncNotSetUp, type PulledRecord } from "@/lib/workspace-sync";
import type { WorkspaceChoice } from "@/lib/use-workspaces";
import { DEFAULT_GOLD, SWATCHES, brandFormOf, brandFromForm, hasLogo, validColor, type BrandForm } from "@/lib/workspace-settings";
import { ErrorState, PageSkeleton } from "@/components/states";

type Loaded = { record: PulledRecord | null } | "not-set-up" | { error: string };

// Meeting & Branding, as in the program's Settings (app/js/meeting-brand.js): the synced "brand" record. The logo is
// a picture, so it is chosen on the service PC; everything else can be set here and reaches the PC within a minute.
function Branding({ workspace }: Readonly<{ workspace: WorkspaceChoice }>) {
  const supabase = browserSupabase();
  const canEdit = workspace.role === "owner" || workspace.role === "admin";
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [form, setForm] = useState<BrandForm>({ meeting: "", org: "", color: "", auto: false });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    const { records, error } = await pullWorkspace(supabase, workspace.id);
    if (error) return setLoaded(syncNotSetUp(error) ? "not-set-up" : { error: error.message });
    const record = records.find((r) => r.kind === "brand" && r.id === "brand") ?? null;
    setLoaded({ record });
    setForm(brandFormOf(record?.body));
  }, [supabase, workspace.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  if (loaded === null) return <PageSkeleton />;
  if (loaded === "not-set-up") return <NotSetUp />;
  if ("error" in loaded) return <ErrorState text={loaded.error} onRetry={load} />;
  const record = loaded.record;

  async function save() {
    if (!supabase || !validColor(form.color)) return;
    setBusy(true);
    setNotice(null);
    const base = record ?? { kind: "brand" as const, id: "brand", rev: 0, seq: 0, body: null };
    const body = brandFromForm(form, record?.body);
    const answer = await pushRecord(supabase, workspace.id, base, body);
    setBusy(false);
    if (answer.status === "ok") {
      setLoaded({ record: { ...base, kind: "brand", body: body as PulledRecord["body"], rev: answer.rev } });
      setNotice({ ok: true, text: "Branding saved. The service PC picks it up within about a minute." });
    } else if (answer.status === "conflict") {
      setNotice({ ok: false, text: "Branding was changed on the PC meanwhile. Here is the latest; make your change again." });
      await load();
    } else setNotice({ ok: false, text: answer.message });
  }

  const accent = form.color || DEFAULT_GOLD;
  return (
    <div className="fd-settings-grid">
      <section className="workspace-card fd-settings-card" data-reveal>
        <h2>Meeting & Branding</h2>
        <p className="workspace-hint">
          Your meeting&apos;s name and colour. They appear only where you choose: Branding Content, and text Content that
          asks for them.
        </p>
        <label className="fd-field">
          Meeting Name
          <input value={form.meeting} maxLength={80} disabled={!canEdit} placeholder="e.g. Tuesday Evening Bible Study" onChange={(e) => setForm({ ...form, meeting: e.target.value })} />
        </label>
        <label className="fd-field">
          Leader or organization
          <input value={form.org} maxLength={80} disabled={!canEdit} placeholder="e.g. New Life Fellowship · Mary Thomas" onChange={(e) => setForm({ ...form, org: e.target.value })} />
        </label>
        <div className="fd-field">
          Accent colour
          <div className="fd-swatches" role="radiogroup" aria-label="Accent colour">
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
                {form.color === value && <Check aria-hidden="true" size={15} />}
              </button>
            ))}
            <label className="fd-swatch fd-swatch-custom" title="Another colour">
              <input
                type="color"
                aria-label="Another colour"
                disabled={!canEdit}
                value={form.color || DEFAULT_GOLD}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
              />
            </label>
          </div>
          <span className="workspace-hint">It replaces the gold of the question and scripture cards on screen.</span>
        </div>
        <label className="fd-check">
          <input type="checkbox" checked={form.auto} disabled={!canEdit} onChange={(e) => setForm({ ...form, auto: e.target.checked })} />
          New Frames include branding (Quick Start, Library, + Frame)
        </label>
        {notice && (
          <p className={notice.ok ? "workspace-notice" : "workspace-problem"} role={notice.ok ? "status" : "alert"}>
            {notice.text}
          </p>
        )}
        {canEdit ? (
          <div className="edit-actions">
            <button className="live-btn live-primary" type="button" disabled={busy} onClick={save}>
              {busy ? "Saving…" : "Save branding"}
            </button>
          </div>
        ) : (
          <p className="workspace-hint">View only: owners and admins can change branding.</p>
        )}
      </section>

      <aside className="fd-settings-side" data-reveal style={{ "--d": "120ms" } as React.CSSProperties}>
        <p className="fd-kicker">Preview</p>
        <div className="fd-brand-preview" style={{ "--accent": accent } as React.CSSProperties}>
          <div className="fd-brand-badge">
            <span className="fd-brand-logo" aria-hidden="true">
              <ImageIcon size={18} />
            </span>
            <span>
              <strong>{form.meeting || "Meeting Name"}</strong>
              {form.org && <small>{form.org}</small>}
            </span>
          </div>
          <div className="fd-brand-card">
            <span className="fd-brand-label">Discussion question</span>
            <p>What does this passage reveal about the character of God?</p>
          </div>
        </div>
        <p className="workspace-hint">
          {hasLogo(record?.body)
            ? "Your logo is set on the service PC. To change it: FRAMEDECKS → Settings → Meeting & Branding."
            : "Add a logo on the service PC: FRAMEDECKS → Settings → Meeting & Branding (pictures stay on the PC)."}
        </p>
      </aside>
    </div>
  );
}

export function BrandingPanel() {
  return <WorkspaceGate what="your branding">{(w) => <Branding key={w.id} workspace={w} />}</WorkspaceGate>;
}
