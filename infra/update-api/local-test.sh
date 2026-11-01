#!/usr/bin/env bash
# FrameDecks - the whole release pipeline on this computer, before the first real tag (docs/deployment/release-pipeline.md,
# "Test it locally"). Nothing leaves the computer: the update service runs under `wrangler dev` with a local R2 bucket,
# and downloads.framedecks.com is stood in for by a local file server.
#
#   1. publishes two made-up versions (7.0, then 7.1) with the workflow's own read and upload steps, an `aws` stand-in
#      for the local bucket, and tools/make_release_manifest.py; then checks that publishing 7.1 again, or an older
#      7.0.5, is refused and changes nothing (7.1.2);
#   2. checks every route of the update service;
#   3. runs the program's updater (src/updater.py) as an installed 7.0: it must be offered 7.1, download it with a
#      matching SHA-256, refuse a tampered copy, and fetch 7.0 again as the "previous" version;
#   4. points releases/latest.json back at 7.0 the way the rollback section says, and checks what PCs are offered.
#
# Needs Node.js, Python 3 and PyYAML. Run from anywhere:  bash infra/update-api/local-test.sh
set -euo pipefail
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
W="$(mktemp -d)"; API=8787; DL=8899
WR=(npx --yes wrangler@4.155.0)   # keep equal to the version in the aws stand-in below
cleanup() {   # the servers started below, and their children (wrangler starts several processes)
  kill "${PIDS[@]}" 2>/dev/null || true
  pkill -f -- "--persist-to $W/state" 2>/dev/null || true
  pkill -f -- "http.server $DL --bind 127.0.0.1" 2>/dev/null || true
  rm -rf "${W:?}"
}
PIDS=(); trap cleanup EXIT

echo "== workspace $W"
mkdir -p "$W/tree/tools" "$W/tree/src" "$W/tree/docs/releases" "$W/downloads" "$W/shim"
cp "$REPO/tools/make_release_manifest.py" "$W/tree/tools/"
cp "$REPO/src/server.py" "$W/tree/src/"
for v in 7.0 7.1 7.0.5; do
  printf '## FrameDecks v%s\n\nA made-up release for the local pipeline test.\n\n## What'"'"'s New\n- Test release %s.\n\n## Enhancements\n- None.\n\n## Fixes\n- None.\n\n## Performance Improvements\n- None.\n\n## Known Issues\n- None.\n' "$v" "$v" > "$W/tree/docs/releases/v$v.md"
done
cp -r "$REPO/infra/update-api" "$W/worker"
python3 - "$REPO" "$W" <<'EOF'
import sys, yaml
wf = yaml.safe_load(open(sys.argv[1] + "/.github/workflows/build-windows.yml"))
steps = {s.get("name"): s["run"] for s in wf["jobs"]["publish"]["steps"] if "run" in s}
open(sys.argv[2] + "/upload.sh", "w").write(steps["Upload to Cloudflare R2"])
open(sys.argv[2] + "/read.sh", "w").write(steps["Read the releases already published (from R2)"])
EOF
cat > "$W/shim/aws" <<'EOF'
#!/usr/bin/env bash
# stand-in for the three aws calls the workflow makes, against the local bucket:
#   aws s3api head-object --bucket B --key K --endpoint-url E          (a 404 like S3's when missing)
#   aws s3 cp s3://B/K FILE --endpoint-url E --only-show-errors          (download)
#   aws s3 cp FILE s3://B/K --endpoint-url E [--content-type ...] ...     (upload)
set -e
r2() { (cd "$W/worker" && npx --yes wrangler@4.155.0 r2 object "$@" --local --persist-to "$W/state" >/dev/null 2>&1); }
if [ "$1 $2" = "s3api head-object" ]; then
  r2 get "$4/$6" --file "$W/head.tmp" && exit 0
  echo "An error occurred (404) when calling the HeadObject operation: Not Found" >&2; exit 254
fi
[ "$1 $2" = "s3 cp" ] || { echo "aws stand-in: unexpected $*" >&2; exit 2; }
src="$3"; dst="$4"; shift 4; args=()
while [ $# -gt 0 ]; do case "$1" in
  --content-type|--content-disposition|--cache-control) args+=("$1" "$2"); shift 2;;
  --endpoint-url) shift 2;; --only-show-errors) shift;; *) echo "aws stand-in: unexpected $1" >&2; exit 2;; esac; done
if [ "${src#s3://}" != "$src" ]; then
  echo "  get ${src#s3://}"; r2 get "${src#s3://}" --file "$(pwd)/$dst"
else
  echo "  put ${dst#s3://}"; r2 put "${dst#s3://}" --file "$(cd "$(dirname "$src")" && pwd)/$(basename "$src")" "${args[@]}"
fi
EOF
chmod +x "$W/shim/aws"
export W

echo "== update service (wrangler dev, local bucket)"
(cd "$W/worker" && "${WR[@]}" dev --local --persist-to "$W/state" --port $API --ip 127.0.0.1 > "$W/worker.log" 2>&1) & PIDS+=($!)
(cd "$W/downloads" && python3 -m http.server $DL --bind 127.0.0.1 > /dev/null 2>&1) & PIDS+=($!)
for _ in $(seq 1 60); do curl -fs "http://127.0.0.1:$API/health" > /dev/null && break; sleep 1; done
curl -fs "http://127.0.0.1:$API/health" | grep -q '"latest":false' || { echo "service did not start"; tail "$W/worker.log"; exit 1; }

publish() {   # the workflow's publish job for one version: read (R2), lay out, upload. Non-zero when refused.
  local v="$1"
  rm -rf "${W:?}/run" && mkdir -p "$W/run/dist" && cd "$W/run"
  head -c $((2 * 1024 * 1024)) /dev/urandom > "dist/FrameDecks v$v.exe"
  export PATH="$W/shim:$PATH" VERSION="$v" R2=https://local.r2 BUCKET=framedecks-downloads
  bash "$W/read.sh" || return 1
  python3 "$W/tree/tools/make_release_manifest.py" --installer "dist/FrameDecks v$v.exe" --out publish --index index.json --version "$v" || return 1
  cp -r publish/. "$W/downloads/"
  bash "$W/upload.sh"
}
for v in 7.0 7.1; do
  echo "== publish $v"
  publish "$v"
done
latest_before="$(curl -fs "http://127.0.0.1:$API/releases/latest")"
for v in 7.1 7.0.5; do
  echo "== publish $v again / older (must be refused)"
  if (publish "$v"); then echo "publishing $v was not refused"; exit 1; fi
done
[ "$(curl -fs "http://127.0.0.1:$API/releases/latest")" = "$latest_before" ] || { echo "latest.json changed after a refused publish"; exit 1; }
curl -fs "http://127.0.0.1:$API/releases" | python3 -c "import json,sys; v=[r['version'] for r in json.load(sys.stdin)['releases']]; assert v == ['7.1', '7.0'], v"
echo "  refused, and nothing changed"

echo "== routes"
B="http://127.0.0.1:$API"
code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }
[ "$(code $B/releases/latest)" = 200 ] && [ "$(code $B/releases)" = 200 ] && [ "$(code $B/releases/7.0)" = 200 ] \
  && [ "$(code $B/releases/5.0)" = 404 ] && [ "$(code -X POST $B/releases/latest)" = 405 ] || { echo "routes: FAIL"; exit 1; }
curl -sI "$B/releases/latest" | grep -qi 'access-control-allow-origin: \*' || { echo "CORS header missing"; exit 1; }
echo "  ok"

echo "== updater"
cd "$W"
FRAMEDECKS_UPDATE_API="$B/releases/latest" python3 - "$REPO" "$W" "$DL" <<'EOF'
import sys, json, hashlib, tempfile, urllib.request
from pathlib import Path
repo, w, dl = sys.argv[1], Path(sys.argv[2]), sys.argv[3]
sys.path.insert(0, repo + "/src")
import updater
def opener(req, timeout=0):
    url = req.full_url
    if url.startswith(updater.DOWNLOAD_PREFIX):
        req = urllib.request.Request(f"http://127.0.0.1:{dl}/" + url[len(updater.DOWNLOAD_PREFIX):])
    return urllib.request.urlopen(req, timeout=timeout or 30)
new = lambda v: updater.Updater(Path(tempfile.mkdtemp()), v, frozen=False, opener=opener, platform="win32")
sha = lambda p: hashlib.sha256(Path(p).read_bytes()).hexdigest()
latest = json.loads((w / "downloads/releases/latest.json").read_text())
u = new("7.0"); i = u.check()
assert i["newer"] and i["latest"] == "7.1" and i["previous"] == "7.0", i
p, _ = u.download(); assert sha(p) == latest["sha256"]; print("  7.0 is offered 7.1, download matches")
assert not new("7.1").check()["newer"]; print("  7.1 is offered nothing")
u = new("7.1"); u.check(); p, v = u.download("previous")
assert v == "7.0" and sha(p) == json.loads((w / "downloads/releases/7.0/manifest.json").read_text())["sha256"]
print("  the previous version (7.0) downloads and matches")
f = w / "downloads/releases/7.1/FrameDecks-7.1-Setup.exe"; orig = f.read_bytes()
f.write_bytes(orig[:-1] + bytes([orig[-1] ^ 1]))
try:
    u = new("7.0"); u.check()
    try:
        u.download(); raise SystemExit("a tampered installer was accepted")
    except ValueError:
        print("  a tampered installer is refused")
finally:
    f.write_bytes(orig)
EOF

echo "== rollback (latest back to 7.0)"
(cd "$W/worker" && "${WR[@]}" r2 object put framedecks-downloads/releases/latest.json --file "$W/downloads/releases/7.0/manifest.json" \
  --local --persist-to "$W/state" --content-type application/json > /dev/null 2>&1)
curl -fs "$B/releases/latest" | grep -q '"version": "7.0"' || { echo "rollback: FAIL"; exit 1; }
FRAMEDECKS_UPDATE_API="$B/releases/latest" python3 -c "
import sys, tempfile; from pathlib import Path; sys.path.insert(0, '$REPO/src'); import updater
c = lambda v: updater.Updater(Path(tempfile.mkdtemp()), v, frozen=False).check()
assert c('6.14')['latest'] == '7.0' and not c('7.1')['newer']
print('  new installs get 7.0; PCs already on 7.1 are not downgraded')"
echo "release pipeline: ok"
