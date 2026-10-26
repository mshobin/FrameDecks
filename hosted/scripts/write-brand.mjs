// FRAMEDECKS - writes src/lib/brand.json from the program's own About text (app/js/brand.js) and version
// (server.py APP_VERSION), so the website's About screen says exactly what the program's does. Run before every
// build and `npm run dev`; the file is committed, and tests/brand.test.mjs fails if it is out of date. If the
// program's files are not next to the website (a host that copies only hosted/), the committed file is kept.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = new URL("../../", import.meta.url);

export function brandData() {
  const ctx = { window: {} };
  vm.runInNewContext(readFileSync(new URL("app/js/brand.js", root), "utf8"), ctx);
  const version = /^APP_VERSION = "([^"]+)"/m.exec(readFileSync(new URL("server.py", root), "utf8"))?.[1] ?? "";
  return { ...JSON.parse(JSON.stringify(ctx.window.KCBrand)), version };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (!existsSync(new URL("app/js/brand.js", root))) {
    console.log("write-brand: the program's files are not here; keeping src/lib/brand.json");
  } else {
    writeFileSync(new URL("../src/lib/brand.json", import.meta.url), `${JSON.stringify(brandData(), null, 2)}\n`);
    console.log("write-brand: src/lib/brand.json written");
  }
}
