export const SYNC_PROTOCOL_VERSION = 1 as const;
export const MAX_SYNC_OPERATION_BYTES = 512 * 1024;
export const MAX_OUTBOX_ENTRIES = 100;
export const MAX_OUTBOX_BYTES = 5 * 1024 * 1024;
export const MAX_FRAMES = 500;
export const MAX_CONTENT_ITEMS_PER_FRAME = 60;
export const MAX_CONTENT_TEXT_LENGTH = 8_000;
export const MAX_SPEAKER_NOTES_LENGTH = 20_000;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LOCAL_PATH_PATTERN =
  /(?:^|[\s"'(])(?:[a-z]:[\\/]|\\\\[^\\]+\\|file:\/\/|\/(?:users|home|mnt|volumes|private|var|tmp)\/)/i;
const TRANSITIONS = [
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
] as const;
const MEDIA_TYPES = ["image", "video", "audio", "pdf"] as const;

export type MediaTypeV1 = (typeof MEDIA_TYPES)[number];
export type TransitionV1 = (typeof TRANSITIONS)[number];

export type TextContentV1 = {
  id: string;
  kind: "question" | "text";
  label: string;
  text: string;
};

export type ScriptureContentV1 = {
  id: string;
  kind: "scripture";
  label: string;
  text: string;
  reference: string;
  translation: string;
};

export type AssetContentV1 = {
  id: string;
  kind: "asset";
  label: string;
  assetId: string;
  mediaType: MediaTypeV1;
};

export type ContentV1 = TextContentV1 | ScriptureContentV1 | AssetContentV1;

export type FrameV1 = {
  id: string;
  title: string;
  position: number;
  transition: TransitionV1;
  contents: ContentV1[];
  speakerNotes?: string;
};

export type PresentationDefinitionV1 = {
  schemaVersion: 1;
  id: string;
  title: string;
  frames: FrameV1[];
};

export type SyncOperationV1 = {
  protocolVersion: 1;
  operationId: string;
  organizationId: string;
  documentId: string;
  baseRevision: number;
  createdAt: string;
  definition: PresentationDefinitionV1;
};

export type RevisionCheck =
  | { status: "apply"; currentRevision: number }
  | { status: "conflict"; expectedRevision: number; currentRevision: number };

export class SyncContractError extends Error {
  readonly code:
    | "invalid-json"
    | "invalid-shape"
    | "invalid-value"
    | "payload-too-large"
    | "outbox-full"
    | "idempotency-key-reuse";

  constructor(
    message: string,
    code: SyncContractError["code"],
  ) {
    super(message);
    this.name = "SyncContractError";
    this.code = code;
  }
}

function fail(code: SyncContractError["code"], message: string): never {
  throw new SyncContractError(message, code);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertKeys(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = [],
): void {
  const allowed = new Set([...required, ...optional]);
  if (required.some((key) => !(key in value)) || Object.keys(value).some((key) => !allowed.has(key))) {
    fail("invalid-shape", "The sync payload contains missing or unsupported fields.");
  }
}

function assertString(value: unknown, field: string, maxLength: number): asserts value is string {
  if (
    typeof value !== "string" ||
    value.length > maxLength ||
    value.includes("\u0000") ||
    LOCAL_PATH_PATTERN.test(value) ||
    /data:(?:image|video|audio|application)\/[^;,]+;base64,/i.test(value)
  ) {
    fail("invalid-value", `${field} is invalid, contains a local path or media data URL, or exceeds its size limit.`);
  }
}

function assertUuid(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    fail("invalid-value", `${field} must be a UUID.`);
  }
}

function assertNonNegativeInteger(value: unknown, field: string): asserts value is number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    fail("invalid-value", `${field} must be a non-negative safe integer.`);
  }
}

function assertContent(value: unknown): asserts value is ContentV1 {
  if (!isRecord(value)) fail("invalid-shape", "Content must be an object.");

  if (value.kind === "asset") {
    assertKeys(value, ["id", "kind", "label", "assetId", "mediaType"]);
    assertUuid(value.id, "content.id");
    assertString(value.label, "content.label", 120);
    assertUuid(value.assetId, "content.assetId");
    if (typeof value.mediaType !== "string" || !MEDIA_TYPES.includes(value.mediaType as MediaTypeV1)) {
      fail("invalid-value", "content.mediaType is unsupported.");
    }
    return;
  }

  if (value.kind === "scripture") {
    assertKeys(value, ["id", "kind", "label", "text", "reference", "translation"]);
    assertUuid(value.id, "content.id");
    assertString(value.label, "content.label", 120);
    assertString(value.text, "content.text", MAX_CONTENT_TEXT_LENGTH);
    assertString(value.reference, "content.reference", 160);
    assertString(value.translation, "content.translation", 80);
    return;
  }

  if (value.kind === "question" || value.kind === "text") {
    assertKeys(value, ["id", "kind", "label", "text"]);
    assertUuid(value.id, "content.id");
    assertString(value.label, "content.label", 120);
    assertString(value.text, "content.text", MAX_CONTENT_TEXT_LENGTH);
    return;
  }

  fail("invalid-value", "content.kind is unsupported.");
}

export function validatePresentationDefinition(value: unknown): asserts value is PresentationDefinitionV1 {
  if (!isRecord(value)) fail("invalid-shape", "The presentation definition must be an object.");
  assertKeys(value, ["schemaVersion", "id", "title", "frames"]);
  if (value.schemaVersion !== 1) fail("invalid-value", "Unsupported presentation schema version.");
  assertUuid(value.id, "definition.id");
  assertString(value.title, "definition.title", 160);
  if (!Array.isArray(value.frames) || value.frames.length > MAX_FRAMES) {
    fail("invalid-value", `definition.frames must contain at most ${MAX_FRAMES} frames.`);
  }

  const frameIds = new Set<string>();
  const contentIds = new Set<string>();
  const positions = new Set<number>();
  for (const frame of value.frames) {
    if (!isRecord(frame)) fail("invalid-shape", "Each frame must be an object.");
    assertKeys(frame, ["id", "title", "position", "transition", "contents"], ["speakerNotes"]);
    assertUuid(frame.id, "frame.id");
    assertString(frame.title, "frame.title", 160);
    assertNonNegativeInteger(frame.position, "frame.position");
    if ((frame.position as number) >= MAX_FRAMES || positions.has(frame.position as number)) {
      fail("invalid-value", "Frame positions must be unique and within the supported range.");
    }
    if (frameIds.has(frame.id)) fail("invalid-value", "Frame IDs must be unique.");
    frameIds.add(frame.id);
    positions.add(frame.position as number);

    if (typeof frame.transition !== "string" || !TRANSITIONS.includes(frame.transition as TransitionV1)) {
      fail("invalid-value", "frame.transition is unsupported.");
    }
    if (!Array.isArray(frame.contents) || frame.contents.length > MAX_CONTENT_ITEMS_PER_FRAME) {
      fail("invalid-value", `Each frame must contain at most ${MAX_CONTENT_ITEMS_PER_FRAME} content items.`);
    }
    if ("speakerNotes" in frame) {
      assertString(frame.speakerNotes, "frame.speakerNotes", MAX_SPEAKER_NOTES_LENGTH);
    }
    for (const content of frame.contents) {
      assertContent(content);
      if (contentIds.has(content.id)) fail("invalid-value", "Content IDs must be unique in a definition.");
      contentIds.add(content.id);
    }
  }
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function serializeSyncOperation(value: unknown): string {
  validateSyncOperation(value);
  const serialized = JSON.stringify(value);
  if (new TextEncoder().encode(serialized).byteLength > MAX_SYNC_OPERATION_BYTES) {
    fail("payload-too-large", `A sync operation must not exceed ${MAX_SYNC_OPERATION_BYTES} bytes.`);
  }
  return serialized;
}

export function validateSyncOperation(value: unknown): asserts value is SyncOperationV1 {
  if (!isRecord(value)) fail("invalid-shape", "A sync operation must be an object.");
  assertKeys(value, [
    "protocolVersion",
    "operationId",
    "organizationId",
    "documentId",
    "baseRevision",
    "createdAt",
    "definition",
  ]);
  if (value.protocolVersion !== SYNC_PROTOCOL_VERSION) fail("invalid-value", "Unsupported sync protocol version.");
  assertUuid(value.operationId, "operationId");
  assertUuid(value.organizationId, "organizationId");
  assertUuid(value.documentId, "documentId");
  assertNonNegativeInteger(value.baseRevision, "baseRevision");
  if (
    typeof value.createdAt !== "string" ||
    !Number.isFinite(Date.parse(value.createdAt)) ||
    new Date(value.createdAt).toISOString() !== value.createdAt
  ) {
    fail("invalid-value", "createdAt must be a UTC ISO-8601 timestamp with milliseconds.");
  }
  validatePresentationDefinition(value.definition);
  if (value.documentId !== value.definition.id) {
    fail("invalid-value", "documentId must match definition.id.");
  }
  const encoded = JSON.stringify(value);
  if (new TextEncoder().encode(encoded).byteLength > MAX_SYNC_OPERATION_BYTES) {
    fail("payload-too-large", `A sync operation must not exceed ${MAX_SYNC_OPERATION_BYTES} bytes.`);
  }
}

export function parseSyncOperation(json: string): SyncOperationV1 {
  if (new TextEncoder().encode(json).byteLength > MAX_SYNC_OPERATION_BYTES) {
    fail("payload-too-large", `A sync operation must not exceed ${MAX_SYNC_OPERATION_BYTES} bytes.`);
  }
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    fail("invalid-json", "The sync operation is not valid JSON.");
  }
  validateSyncOperation(value);
  return value;
}

export function checkBaseRevision(baseRevision: number, currentRevision: number): RevisionCheck {
  assertNonNegativeInteger(baseRevision, "baseRevision");
  assertNonNegativeInteger(currentRevision, "currentRevision");
  return baseRevision === currentRevision
    ? { status: "apply", currentRevision }
    : { status: "conflict", expectedRevision: baseRevision, currentRevision };
}

export function appendToOutbox(
  outbox: readonly SyncOperationV1[],
  incoming: SyncOperationV1,
): SyncOperationV1[] {
  serializeSyncOperation(incoming);
  const incomingCanonical = canonicalJson(incoming);
  const existing = outbox.find((operation) => operation.operationId === incoming.operationId);
  if (existing) {
    if (canonicalJson(existing) !== incomingCanonical) {
      fail("idempotency-key-reuse", "An operation ID cannot be reused with different content.");
    }
    return [...outbox];
  }

  if (outbox.length >= MAX_OUTBOX_ENTRIES) {
    fail("outbox-full", `The local outbox is limited to ${MAX_OUTBOX_ENTRIES} operations.`);
  }
  const next = [...outbox, incoming];
  const totalBytes = next.reduce(
    (sum, operation) => sum + new TextEncoder().encode(serializeSyncOperation(operation)).byteLength,
    0,
  );
  if (totalBytes > MAX_OUTBOX_BYTES) {
    fail("outbox-full", `The local outbox is limited to ${MAX_OUTBOX_BYTES} bytes.`);
  }
  return next;
}
