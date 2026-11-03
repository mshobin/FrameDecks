import assert from "node:assert/strict";
import { test } from "node:test";

import { isFramedecksCamera, placeOf, setupOf } from "../src/lib/pc-setup.ts";

const WIN = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0 Safari/537.36";

test("the FRAMEDECKS camera is recognised under its current and earlier names", () => {
  for (const name of ["FrameDecks vCam", "FRAMECAST", "FRAMEDECKS", "FRAMEDECKS Camera", "BCC vCam"]) assert.ok(isFramedecksCamera(name), name);
  for (const name of ["Integrated Webcam (0c45:6a10)", "OBS Virtual Camera", ""]) assert.ok(!isFramedecksCamera(name), name);
});

test("phones and other computers are told what applies to them", () => {
  assert.equal(placeOf("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)"), "phone");
  assert.equal(placeOf("Mozilla/5.0 (Linux; Android 15; Pixel 9) Mobile"), "phone");
  assert.equal(placeOf("Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0)"), "other");
  assert.equal(placeOf(WIN), "windows");
  assert.equal(setupOf("phone", ["FRAMEDECKS"]), "phone");
  assert.equal(setupOf("other", []), "other");
});

test("on Windows: found, missing, or ask while the names are hidden", () => {
  assert.equal(setupOf("windows", ["Integrated Webcam", "FRAMEDECKS"]), "found");
  assert.equal(setupOf("windows", ["Integrated Webcam"]), "missing");
  assert.equal(setupOf("windows", ["", ""]), "ask"); // cameras exist, names hidden until access is allowed
  assert.equal(setupOf("windows", []), "ask");
});
