import {
  MAX_CONTENT_ITEMS_PER_FRAME,
  MAX_FRAMES,
  MAX_SPEAKER_NOTES_LENGTH,
  SyncContractError,
  validatePresentationDefinition,
  type ContentV1,
  type FrameV1,
  type MediaTypeV1,
  type PresentationDefinitionV1,
  type TransitionV1,
} from "./contracts.mts";

export const LEGACY_IMPORT_MAX_BYTES = 5 * 1024 * 1024;
export const LEGACY_EXPORT_FORMAT = "framedecks-6.9-metadata";

const TRANSITIONS = new Set<TransitionV1>([
  "cut",
  "fade",
  "dissolve",
  "dip-black",
  "dip-white",
  "blur-fade",
  "zoom-fade",
  "slide-left",
  "slide-right",
  "push",
  "reveal",
  "soft-scale",
  "cinema",
  "church",
]);

const CONTENT_KINDS = new Set(["question", "scripture", "announcement", "prayer", "lowerthird", "text"]);
const MEDIA_LAYER_TYPES: Record<string, MediaTypeV1> = {
  image: "image",
  video: "video",
  pdf: "pdf",
};

export type LegacyImportIssue = {
  code: "unsupported-data" | "missing-local-asset" | "invalid-data";
  location: string;
  message: string;
};

export type LegacyImportPlan = {
  definition: PresentationDefinitionV1;
  issues: LegacyImportIssue[];
  excludedPersonalFields: string[];
  safeToCommit: boolean;
};

export type LegacyImportOptions = {
  documentId: string;
  idForLegacyId: (kind: "frame" | "content", legacyId: string) => string;
  assetIdForLegacyReference?: (
    localReference: string,
    mediaType: MediaTypeV1,
  ) => string | null;
};

export type LegacyExportOptions = {
  exportedAt: string;
};

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isSafeString(value: unknown, maxLength: number): value is string {
  return (
    typeof value === "string" &&
    value.length <= maxLength &&
    !value.includes("\u0000") &&
    !/(?:^|[\s"'(])(?:[a-z]:[\\/]|\\\\[^\\]+\\|file:\/\/|\/(?:users|home|mnt|volumes|private|var|tmp)\/)/i.test(
      value,
    ) &&
    !/data:(?:image|video|audio|application)\/[^;,]+;base64,/i.test(value)
  );
}

function validId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

function fail(code: ConstructorParameters<typeof SyncContractError>[1], message: string): never {
  throw new SyncContractError(message, code);
}

function readJson(json: string): unknown {
  if (new TextEncoder().encode(json).byteLength > LEGACY_IMPORT_MAX_BYTES) {
    fail("payload-too-large", `A FrameDecks 6.9 import must not exceed ${LEGACY_IMPORT_MAX_BYTES} bytes.`);
  }
  try {
    return JSON.parse(json) as unknown;
  } catch {
    fail("invalid-json", "The FrameDecks 6.9 export is not valid JSON.");
  }
}

function readFrameTransition(value: unknown, location: string, issues: LegacyImportIssue[]): TransitionV1 {
  if (isRecord(value) && typeof value.type === "string" && TRANSITIONS.has(value.type as TransitionV1)) {
    return value.type as TransitionV1;
  }
  issues.push({
    code: "unsupported-data",
    location,
    message: "Unknown or missing transition was replaced with a cut.",
  });
  return "cut";
}

function reportUnmappedFields(
  value: RecordValue,
  allowed: readonly string[],
  location: string,
  issues: LegacyImportIssue[],
): void {
  const allowedFields = new Set(allowed);
  const omitted = Object.keys(value).filter((key) => !allowedFields.has(key));
  if (omitted.length) {
    issues.push({
      code: "unsupported-data",
      location,
      message: `Fields not represented in the portable schema were omitted (${omitted.length} field${omitted.length === 1 ? "" : "s"}).`,
    });
  }
}

function rawTextContent(
  id: string,
  kind: "question" | "text" | "scripture",
  labelValue: unknown,
  textValue: unknown,
  location: string,
  issues: LegacyImportIssue[],
  reference?: unknown,
  translation?: unknown,
): ContentV1 | null {
  const label = typeof labelValue === "string" ? labelValue : "";
  const text = typeof textValue === "string" ? textValue : "";
  const ref = typeof reference === "string" ? reference : "";
  const version = typeof translation === "string" ? translation : "";
  if (
    !isSafeString(label, 120) ||
    !isSafeString(text, 8_000) ||
    !isSafeString(ref, 160) ||
    !isSafeString(version, 80)
  ) {
    issues.push({
      code: "invalid-data",
      location,
      message: "Content contains a local path, embedded media data, or a value above the supported limit.",
    });
    return null;
  }
  if (kind === "scripture") {
    return { id, kind, label, text, reference: ref, translation: version };
  }
  return { id, kind, label, text };
}

function importLayer(
  layer: RecordValue,
  layerIndex: number,
  frameIndex: number,
  options: LegacyImportOptions,
  issues: LegacyImportIssue[],
): ContentV1[] {
  const location = `scenes[${frameIndex}].layers[${layerIndex}]`;
  if (typeof layer.kind !== "string") {
    issues.push({ code: "unsupported-data", location, message: "Layer has no supported content kind and was skipped." });
    return [];
  }

  const idFor = (suffix: string) =>
    options.idForLegacyId("content", `${String(layer.id || `scene-${frameIndex}-layer-${layerIndex}`)}:${suffix}`);
  const content = isRecord(layer.c) ? layer.c : {};
  const label = typeof layer.name === "string" ? layer.name : "";
  if (
    layer.visible === false ||
    layer.locked === true ||
    (typeof layer.opacity === "number" && layer.opacity !== 1)
  ) {
    issues.push({
      code: "unsupported-data",
      location,
      message: "Layer visibility, lock, or opacity settings are not represented in the portable schema.",
    });
  }

  if (CONTENT_KINDS.has(layer.kind)) {
    const allowedContentFields =
      layer.kind === "question" || layer.kind === "scripture"
        ? ["items", "label", "vcam", "obs"]
        : ["title", "text", "label", "vcam", "obs"];
    reportUnmappedFields(content, allowedContentFields, `${location}.c`, issues);
    if (layer.kind !== "question" && layer.kind !== "scripture" && layer.kind !== "text") {
      issues.push({
        code: "unsupported-data",
        location,
        message: `The "${layer.kind}" presentation style was reduced to plain text metadata.`,
      });
    }
    const items = Array.isArray(content.items) ? content.items : null;
    if (items) {
      return items.flatMap((item, itemIndex) => {
        if (!isRecord(item)) {
          issues.push({
            code: "invalid-data",
            location: `${location}.c.items[${itemIndex}]`,
            message: "Content item must be an object and was skipped.",
          });
          return [];
        }
        reportUnmappedFields(
          item,
          layer.kind === "question"
            ? ["id", "label", "text"]
            : layer.kind === "scripture"
              ? ["id", "label", "text", "ref", "version"]
              : ["id", "label", "text"],
          `${location}.c.items[${itemIndex}]`,
          issues,
        );
        const itemId = idFor(String(item.id || itemIndex));
        const kind = layer.kind === "question" ? "question" : layer.kind === "scripture" ? "scripture" : "text";
        const mapped = rawTextContent(
          itemId,
          kind,
          item.label || content.label || label,
          item.text || "",
          `${location}.c.items[${itemIndex}]`,
          issues,
          item.ref,
          item.version,
        );
        return mapped ? [mapped] : [];
      });
    }
    const kind = layer.kind === "question" ? "question" : layer.kind === "scripture" ? "scripture" : "text";
    const mapped = rawTextContent(
      idFor("0"),
      kind,
      content.title || content.label || label,
      content.text || "",
      location,
      issues,
      content.ref,
      content.version,
    );
    return mapped ? [mapped] : [];
  }

  const mediaType = MEDIA_LAYER_TYPES[layer.kind];
  if (mediaType) {
    reportUnmappedFields(content, ["file", "assetId", "vcam", "obs"], `${location}.c`, issues);
    const opaqueAssetId = typeof content.assetId === "string" && validId(content.assetId)
      ? content.assetId
      : typeof content.file === "string" && content.file && options.assetIdForLegacyReference
        ? options.assetIdForLegacyReference(content.file, mediaType)
        : null;
    if (!opaqueAssetId || !validId(opaqueAssetId)) {
      issues.push({
        code: "missing-local-asset",
        location,
        message: "Media has no local logical-asset mapping and was skipped.",
      });
      return [];
    }
    return [{
      id: idFor("0"),
      kind: "asset",
      label,
      assetId: opaqueAssetId,
      mediaType,
    }];
  }

  issues.push({
    code: "unsupported-data",
    location,
    message: `Layer kind "${layer.kind}" is not portable metadata and was skipped.`,
  });
  return [];
}

function readLegacyRoot(value: unknown): RecordValue {
  if (!isRecord(value)) fail("invalid-shape", "The FrameDecks 6.9 export must be a JSON object.");
  if (value.format === LEGACY_EXPORT_FORMAT && value.schemaVersion === 1 && isRecord(value.state)) {
    return value.state;
  }
  return value;
}

export function planLegacy69Import(json: string, options: LegacyImportOptions): LegacyImportPlan {
  if (!validId(options.documentId)) fail("invalid-value", "documentId must be a UUID.");
  if (typeof options.idForLegacyId !== "function") {
    fail("invalid-value", "A stable legacy-ID mapping function is required for repeatable import previews.");
  }

  const root = readLegacyRoot(readJson(json));
  if (!Array.isArray(root.scenes) || root.scenes.length > MAX_FRAMES) {
    fail("invalid-value", `The legacy export must contain no more than ${MAX_FRAMES} scenes.`);
  }

  const issues: LegacyImportIssue[] = [];
  const frames: FrameV1[] = [];
  const frameIds = new Set<string>();
  const contentIds = new Set<string>();
  for (const [frameIndex, scene] of root.scenes.entries()) {
    const location = `scenes[${frameIndex}]`;
    if (!isRecord(scene) || !Array.isArray(scene.layers)) {
      issues.push({ code: "invalid-data", location, message: "Scene is malformed and was skipped." });
      continue;
    }
    const frameId = options.idForLegacyId("frame", String(scene.id || `scene-${frameIndex}`));
    if (!validId(frameId) || frameIds.has(frameId)) {
      issues.push({ code: "invalid-data", location, message: "Scene ID mapping is invalid or duplicated; scene was skipped." });
      continue;
    }
    if (!isSafeString(scene.name, 160)) {
      issues.push({ code: "invalid-data", location, message: "Scene title is invalid; scene was skipped." });
      continue;
    }
    const contents = scene.layers.flatMap((layer, layerIndex) => {
      if (isRecord(layer)) return importLayer(layer, layerIndex, frameIndex, options, issues);
      issues.push({
        code: "invalid-data",
        location: `${location}.layers[${layerIndex}]`,
        message: "Layer must be an object and was skipped.",
      });
      return [];
    });
    if (contents.length > MAX_CONTENT_ITEMS_PER_FRAME) {
      issues.push({
        code: "invalid-data",
        location,
        message: `Scene exceeds the ${MAX_CONTENT_ITEMS_PER_FRAME}-content limit and was skipped.`,
      });
      continue;
    }
    if (contents.some((content) => contentIds.has(content.id))) {
      issues.push({ code: "invalid-data", location, message: "Scene has duplicated mapped content IDs and was skipped." });
      continue;
    }
    contents.forEach((content) => contentIds.add(content.id));
    frameIds.add(frameId);

    const notes = typeof scene.notes === "string" ? scene.notes : "";
    if (!isSafeString(notes, MAX_SPEAKER_NOTES_LENGTH)) {
      issues.push({
        code: "invalid-data",
        location: `${location}.notes`,
        message: "Speaker notes contain a local path, embedded media data, or exceed the supported limit.",
      });
      continue;
    }
    if (
      scene.fav === true ||
      scene.tpl === true ||
      (typeof scene.group === "string" && scene.group.length > 0) ||
      (isRecord(scene.auto) && (scene.auto.on === true || scene.auto.sec !== undefined && scene.auto.sec !== 30)) ||
      (isRecord(scene.out) && (scene.out.vcam === false || scene.out.obs === false))
    ) {
      issues.push({
        code: "unsupported-data",
        location,
        message: "Scene grouping, favorite/template status, auto-advance, or output preferences are not represented.",
      });
    }
    frames.push({
      id: frameId,
      title: scene.name,
      position: frameIndex,
      transition: readFrameTransition(scene.tx, `${location}.tx`, issues),
      contents,
      ...(notes ? { speakerNotes: notes } : {}),
    });
  }

  const excludedPersonalFields = [
    "meeting.contact",
    "meeting.attendees",
    "meeting.attendeeNotes",
    "meeting.owner",
    "birthday",
    "members",
  ];
  const sourceTitle = isRecord(root.meeting) ? root.meeting.title : "";
  if (!isSafeString(sourceTitle, 160)) {
    issues.push({
      code: "invalid-data",
      location: "meeting.title",
      message: "Meeting title contains a local path, embedded media data, or exceeds the supported limit.",
    });
  }
  const definition: PresentationDefinitionV1 = {
    schemaVersion: 1,
    id: options.documentId,
    title: isSafeString(sourceTitle, 160) && sourceTitle ? sourceTitle : "Imported presentation",
    frames,
  };
  validatePresentationDefinition(definition);
  return {
    definition,
    issues,
    excludedPersonalFields,
    safeToCommit: issues.length === 0,
  };
}

function toLegacyLayer(content: ContentV1): RecordValue {
  if (content.kind === "question") {
    return {
      id: content.id,
      kind: "question",
      name: content.label,
      visible: true,
      locked: false,
      opacity: 1,
      c: { items: [{ id: content.id, text: content.text }] },
    };
  }
  if (content.kind === "scripture") {
    return {
      id: content.id,
      kind: "scripture",
      name: content.label,
      visible: true,
      locked: false,
      opacity: 1,
      c: { items: [{ id: content.id, ref: content.reference, version: content.translation, text: content.text }] },
    };
  }
  if (content.kind === "text") {
    return {
      id: content.id,
      kind: "announcement",
      name: content.label,
      visible: true,
      locked: false,
      opacity: 1,
      c: { title: content.label, text: content.text },
    };
  }
  if (content.kind !== "asset") {
    fail("invalid-value", "The content kind cannot be represented in the FrameDecks metadata export.");
  }
  if (content.mediaType === "audio") {
    fail("invalid-value", "Audio asset references have no matching FrameDecks 6.9 layer type.");
  }
  return {
    id: content.id,
    kind: content.mediaType === "image" ? "image" : content.mediaType === "pdf" ? "pdf" : "video",
    name: content.label,
    visible: true,
    locked: false,
    opacity: 1,
    c: { file: "", assetId: content.assetId },
  };
}

export function exportAsLegacy69Metadata(
  definition: PresentationDefinitionV1,
  options: LegacyExportOptions,
): string {
  validatePresentationDefinition(definition);
  if (!Number.isFinite(Date.parse(options.exportedAt)) || new Date(options.exportedAt).toISOString() !== options.exportedAt) {
    fail("invalid-value", "exportedAt must be a UTC ISO-8601 timestamp with milliseconds.");
  }

  const exportedState = {
    rev: 0,
    v6: true,
    meeting: { title: definition.title },
    scenes: definition.frames.map((frame) => ({
      id: frame.id,
      name: frame.title,
      created: 0,
      modified: 0,
      version: 1,
      notes: frame.speakerNotes || "",
      tx: { type: frame.transition, ms: 0 },
      auto: { on: false, sec: 30 },
      out: { vcam: true, obs: true },
      layers: frame.contents.map(toLegacyLayer),
    })),
  };

  const result = JSON.stringify(
    {
      format: LEGACY_EXPORT_FORMAT,
      schemaVersion: 1,
      exportedAt: options.exportedAt,
      state: exportedState,
    },
    null,
    2,
  );
  if (new TextEncoder().encode(result).byteLength > LEGACY_IMPORT_MAX_BYTES) {
    fail("payload-too-large", `A metadata export must not exceed ${LEGACY_IMPORT_MAX_BYTES} bytes.`);
  }
  return result;
}
