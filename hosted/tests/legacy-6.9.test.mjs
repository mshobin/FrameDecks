import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  exportAsLegacy69Metadata,
  LEGACY_EXPORT_FORMAT,
  LEGACY_IMPORT_MAX_BYTES,
  planLegacy69Import,
} from "../src/lib/sync/legacy-6.9.mts";
import { SyncContractError } from "../src/lib/sync/contracts.mts";

const ids = {
  document: "85887ba3-7af7-469b-b5ad-24b732448212",
  asset: "dfc92a10-9174-4b29-949a-714414b93f08",
};

function stableIdMapper() {
  const idsByLegacyKey = new Map();
  let next = 1;
  return (_kind, legacyId) => {
    if (/^[0-9a-f-]{36}$/i.test(legacyId)) return legacyId;
    const mappedCanonicalId = /^([0-9a-f-]{36}):/.exec(legacyId)?.[1];
    if (mappedCanonicalId) return mappedCanonicalId;
    if (!idsByLegacyKey.has(legacyId)) {
      idsByLegacyKey.set(
        legacyId,
        `00000000-0000-4000-8000-${String(next++).padStart(12, "0")}`,
      );
    }
    return idsByLegacyKey.get(legacyId);
  };
}

function importOptions() {
  return {
    documentId: ids.document,
    idForLegacyId: stableIdMapper(),
    assetIdForLegacyReference: (localReference, mediaType) => {
      assert.equal(localReference, "C:\\Meetings\\opening.mp4");
      assert.equal(mediaType, "video");
      return ids.asset;
    },
  };
}

async function sampleLegacyJson() {
  return readFile(new URL("./fixtures/framedecks-6.9-sample.json", import.meta.url), "utf8");
}

test("6.9 import preview maps supported content, media IDs and private-field exclusions", async () => {
  const plan = planLegacy69Import(await sampleLegacyJson(), importOptions());
  assert.equal(plan.definition.title, "Sunday Gathering");
  assert.equal(plan.definition.frames.length, 2);
  assert.equal(plan.definition.frames[0].speakerNotes, "Welcome the group, then read the passage.");
  assert.deepEqual(
    plan.definition.frames[0].contents.map((content) => content.kind),
    ["scripture", "question", "asset"],
  );
  assert.deepEqual(plan.definition.frames[0].contents[0], {
    id: "00000000-0000-4000-8000-000000000002",
    kind: "scripture",
    label: "Focus Verse",
    text: "Thy word is a lamp unto my feet, and a light unto my path.",
    reference: "Psalm 119:105",
    translation: "KJV",
  });
  assert.equal(plan.definition.frames[0].contents[2].assetId, ids.asset);
  assert.equal(plan.safeToCommit, false);
  assert.equal(plan.issues.length, 3);
  assert.ok(plan.issues.every((issue) => issue.code === "unsupported-data"));
  assert.ok(plan.excludedPersonalFields.includes("meeting.contact"));
  assert.doesNotMatch(JSON.stringify(plan), /private@example\.invalid|Private attendee notes|Private owner|C:\\\\Meetings/);
});

test("repeatable import mapping produces identical preview IDs", async () => {
  const json = await sampleLegacyJson();
  assert.deepEqual(
    planLegacy69Import(json, importOptions()).definition,
    planLegacy69Import(json, importOptions()).definition,
  );
});

test("portable metadata export excludes local paths and private meeting data, then imports losslessly", async () => {
  const initial = planLegacy69Import(await sampleLegacyJson(), importOptions());
  const portableDefinition = {
    ...initial.definition,
    frames: [initial.definition.frames[0]],
  };
  portableDefinition.frames[0].contents = portableDefinition.frames[0].contents.filter(
    (content) => content.kind !== "question",
  );
  const exported = exportAsLegacy69Metadata(portableDefinition, {
    exportedAt: "2026-10-25T18:00:00.000Z",
  });
  assert.equal(JSON.parse(exported).format, LEGACY_EXPORT_FORMAT);
  assert.doesNotMatch(exported, /private@example\.invalid|Private attendee notes|Private owner|C:\\\\Meetings\\\\opening\.mp4/);
  assert.match(exported, new RegExp(ids.asset));

  const reimported = planLegacy69Import(exported, {
    documentId: ids.document,
    idForLegacyId: stableIdMapper(),
  });
  assert.equal(reimported.safeToCommit, true);
  assert.deepEqual(reimported.issues, []);
  assert.deepEqual(reimported.definition, portableDefinition);
});

test("legacy import rejects malformed, oversized and unsafe source content", async () => {
  assert.throws(
    () => planLegacy69Import("{", importOptions()),
    (error) => error instanceof SyncContractError && error.code === "invalid-json",
  );
  assert.throws(
    () => planLegacy69Import(" ".repeat(LEGACY_IMPORT_MAX_BYTES + 1), importOptions()),
    (error) => error instanceof SyncContractError && error.code === "payload-too-large",
  );

  const malicious = JSON.parse(await sampleLegacyJson());
  malicious.scenes[0].layers[0].c.items[0].text = "C:\\Users\\Private\\notes.txt";
  const plan = planLegacy69Import(JSON.stringify(malicious), importOptions());
  assert.equal(plan.safeToCommit, false);
  assert.ok(plan.issues.some((issue) => issue.code === "invalid-data"));
  assert.doesNotMatch(JSON.stringify(plan), /C:\\\\Users\\\\Private/);
});

test("missing media mapping is reported rather than inventing a cloud reference", async () => {
  const json = await sampleLegacyJson();
  const plan = planLegacy69Import(json, {
    documentId: ids.document,
    idForLegacyId: stableIdMapper(),
  });
  assert.ok(plan.issues.some((issue) => issue.code === "missing-local-asset"));
  assert.equal(plan.safeToCommit, false);
});

test("export rejects media kinds without a corresponding 6.9 layer type", async () => {
  const initial = planLegacy69Import(await sampleLegacyJson(), importOptions());
  const definition = {
    ...initial.definition,
    frames: [{
      ...initial.definition.frames[0],
      contents: [{
        id: "077cc0a1-2e6c-4b1d-8a6c-bf39c5f448a4",
        kind: "asset",
        label: "Audio",
        assetId: ids.asset,
        mediaType: "audio",
      }],
    }],
  };
  assert.throws(
    () => exportAsLegacy69Metadata(definition, { exportedAt: "2026-10-25T18:00:00.000Z" }),
    (error) => error instanceof SyncContractError && error.code === "invalid-value",
  );
});
