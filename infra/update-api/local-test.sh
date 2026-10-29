#!/usr/bin/env bash
# FrameDecks - the whole release pipeline on this computer, before the first real tag (docs/deployment/release-pipeline.md,
# "Test it locally"). Nothing leaves the computer: the update service runs under `wrangler dev` with a local R2 bucket,
# and downloads.framedecks.com is stood in for by a local file server.
#
#   1. publishes two made-up versions (7.0, then 7.1) with the workflow's own upload step, an `aws` stand-in writing
#      to the local bucket, and tools/make_release_manifest.py;
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
  rm -rf "$W"
}
PIDS=(); trap cleanup EXIT

echo "== workspace $W"
mkdir -p "$W/tree/tools" "$W/tree/src" "$W/tree/docs/releases" "$W/downloads" "$W/shim"
cp "$REPO/tools/make_release_manifest.py" "$W/tree/tools/"
cp "$REPO/src/server.py" "$W/tree/src/"
for v in 7.0 7.1; do
  printf '## FrameDecks v%s\n\nA made-up release for the local pipeline test.\n\n## What'"'"'s New\n- Test release %s.\n\n## Enhancements\n- None.\n\n## Fixes\n- None.\n\n## Performance Improvements\n- None.\n\n## Known Issues\n- None.\n' "$v" "$v" > "$W/tree/docs/releases/v$v.md"
done
cp -r "$REPO/infra/update-api" "$W/worker"
python3 - "$REPO" "$W" <<'EOF'
import sys, yaml
wf = yaml.safe_load(open(sys.argv[1] + "/.github/workflows/build-windows.yml"))
step = next(s for s in wf["jobs"]["publish"]["steps"] if s.get("name") == "Upload to Cloudflare R2")
open(sys.argv[2] + "/upload.sh", "w").write(step["run"])
EOF
cat > "$W/shim/aws" <<'EOF'
#!/usr/bin/env bash
# stand-in for: aws s3 cp SRC s3://BUCKET/KEY --endpoint-url E [--content-type T] [--content-disposition D] [--cache-control C]
set -e
src="$3"; key="${4#s3://}"; shift 4; args=()
while [ $# -gt 0 ]; do case "$1" in
  --content-type|--content-disposition|--cache-control) args+=("$1" "$2"); shift 2;;
  --endpoint-url) shift 2;; --only-show-errors) shift;; *) echo "aws stand-in: unexpected $1" >&2; exit 2;; esac; done
echo "  put $key"
src="$(cd "$(dirname "$src")" && pwd)/$(basename "$src")"
(cd "$W/worker" && npx --yes wrangler@4.155.0 r2 object put "$key" --file "$src" --local --persist-to "$W/state" "${args[@]}" >/dev/null 2>&1)
EOF
chmod +x "$W/shim/aws"
export W

echo "== update service (wrangler dev, local bucket)"
(cd "$W/worker" && "${WR[@]}" dev --local --persist-to "$W/state" --port $API --ip 127.0.0.1 > "$W/worker.log" 2>&1) & PIDS+=($!)
(cd "$W/downloads" && python3 -m http.server $DL --bind 127.0.0.1 > /dev/null 2>&1) & PIDS+=($!)
for _ in $(seq 1 60); do curl -fs "http://127.0.0.1:$API/health" > /dev/null && break; sleep 1; done
curl -fs "http://127.0.0.1:$API/health" | grep -q '"latest":false' || { echo "service did not start"; tail "$W/worker.log"; exit 1; }

for v in 7.0 7.1; do
  echo "== publish $v"
  rm -rf "$W/run" && mkdir -p "$W/run/dist" && cd "$W/run"
  head -c $((2 * 1024 * 1024)) /dev/urandom > "dist/FrameDecks v$v.exe"
  curl -fsS "http://127.0.0.1:$API/releases" -o index.json 2>/dev/null || echo '{"releases":[]}' > index.json
  python3 "$W/tree/tools/make_release_manifest.py" --installer "dist/FrameDecks v$v.exe" --out publish --index index.json --version "$v"
  cp -r publish/. "$W/downloads/"
  PATH="$W/shim:$PATH" VERSION="$v" R2=https://local.r2 BUCKET=framedecks-downloads bash "$W/upload.sh"
done

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
