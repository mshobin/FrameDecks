import assert from "node:assert/strict";
import test from "node:test";
import {
  appendToOutbox,
  checkBaseRevision,
  MAX_SYNC_OPERATION_BYTES,
  parseSyncOperation,
  serializeSyncOperation,
  SyncContractError,
  validatePresentationDefinition,
} from "../src/lib/sync/contracts.mts";

const ids = {
  organization: "6ed09c7e-b10b-4a38-aec3-08fb8c4f6801",
  document: "85887ba3-7af7-469b-b5ad-24b732448212",
  frame: "e1f1e6a5-0567-4965-8c23-8cb80e12fb47",
  content: "077cc0a1-2e6c-4b1d-8a6c-bf39c5f448a4",
  asset: "dfc92a10-9174-4b29-949a-714414b93f08",
  operation: "435e1d0a-79f5-4b74-a225-4412e3e57428",
};

function operation(overrides = {}) {
  return {
    protocolVersion: 1,
    operationId: ids.operation,
    organizationId: ids.organization,
    documentId: ids.document,
    baseRevision: 0,
    createdAt: "2026-10-25T17:00:00.000Z",
    definition: {
      schemaVersion: 1,
      id: ids.document,
      title: "Sunday Service",
      frames: [
        {
          id: ids.frame,
          title: "Welcome",
          position: 0,
          transition: "fade",
          contents: [
            { id: ids.content, kind: "text", label: "Welcome", text: "Welcome to the service." },
          ],
        },
      ],
    },
    ...overrides,
  };
}

function expectContractError(action, code) {
  assert.throws(action, (error) => error instanceof SyncContractError && error.code === code);
}

function uuidFromInt(value) {
  return `00000000-0000-4000-8000-${value.toString(16).padStart(12, "0")}`;
}

test("versioned metadata operation round-trips through bounded JSON", () => {
  const value = operation();
  const encoded = serializeSyncOperation(value);
  assert.deepEqual(parseSyncOperation(encoded), value);
  assert.ok(new TextEncoder().encode(encoded).byteLength <= MAX_SYNC_OPERATION_BYTES);
});

test("media references contain only an opaque ID and media type", () => {
  const value = operation();
  value.definition.frames[0].contents = [
    { id: ids.content, kind: "asset", label: "Intro", assetId: ids.asset, mediaType: "video" },
  ];
  validatePresentationDefinition(value.definition);
  assert.doesNotMatch(serializeSyncOperation(value), /C:\\\\|Users\\\\|fileName|localPath|base64/i);
});

test("unknown fields such as file paths and raw media are rejected", () => {
  const withPath = operation();
  withPath.definition.frames[0].contents[0].localPath = "C:\\Users\\Public\\video.mp4";
  expectContractError(() => serializeSyncOperation(withPath), "invalid-shape");

  const pathInText = operation();
  pathInText.definition.frames[0].contents[0].text = "Open C:\\Users\\Public\\video.mp4";
  expectContractError(() => serializeSyncOperation(pathInText), "invalid-value");

  const withBytes = operation();
  withBytes.definition.frames[0].contents[0].mediaBytes = "AAECAwQFBgc=";
  expectContractError(() => serializeSyncOperation(withBytes), "invalid-shape");
});

test("data URLs, malformed versions, and oversized payloads are rejected", () => {
  const dataUrl = operation();
  dataUrl.definition.frames[0].contents[0].text = "data:video/mp4;base64,AAECAwQFBgc=";
  expectContractError(() => serializeSyncOperation(dataUrl), "invalid-value");

  expectContractError(() => serializeSyncOperation(operation({ protocolVersion: 2 })), "invalid-value");
  const oversized = operation();
  oversized.definition.frames = Array.from({ length: 2 }, (_, frameIndex) => ({
    id: uuidFromInt(frameIndex + 1),
    title: "Frame",
    position: frameIndex,
    transition: "fade",
    contents: Array.from({ length: 60 }, (_, contentIndex) => ({
      id: uuidFromInt(100 + frameIndex * 60 + contentIndex),
      kind: "text",
      label: "Text",
      text: "x".repeat(8_000),
    })),
  }));
  expectContractError(() => serializeSyncOperation(oversized), "payload-too-large");
  expectContractError(
    () => parseSyncOperation(" ".repeat(MAX_SYNC_OPERATION_BYTES + 1)),
    "payload-too-large",
  );
  expectContractError(() => parseSyncOperation("{"), "invalid-json");
});

test("operation IDs are idempotent but cannot be reused for different content", () => {
  const first = operation();
  const queued = appendToOutbox([], first);
  assert.equal(appendToOutbox(queued, operation()).length, 1);
  expectContractError(
    () => appendToOutbox(queued, operation({ baseRevision: 1 })),
    "idempotency-key-reuse",
  );
});

test("base revision mismatch is explicit and does not silently merge", () => {
  assert.deepEqual(checkBaseRevision(4, 4), { status: "apply", currentRevision: 4 });
  assert.deepEqual(checkBaseRevision(4, 5), {
    status: "conflict",
    expectedRevision: 4,
    currentRevision: 5,
  });
});
