"""FRAMEDECKS - syncing service plans with the workspace in the cloud (design: docs/architecture/metadata-sync.md).

Runs in the background only when this PC is linked to a workspace. It never sits on the path of a page, the phone
remote or the camera: presenting works exactly as without it, online or not.

    Engine        one sync round: pull what changed elsewhere, apply it (never to the live Frame), push what changed
                  here. Plain Python on dictionaries, tested against a stand-in cloud (tests/test_cloud_sync.py).
    CloudApi      the Supabase calls over HTTPS (urllib, no extra package): sync_pull / sync_push and linking.
    Service       the background thread, linking, unlinking and the status shown in Settings > FRAMEDECKS account.

Files in the data folder: kc-sync.json (the link, the pull cursor, what the cloud last agreed for each record, and
changes held back while their Frame is live). The computer key is not in the data folder: it is kept in Windows
Credential Manager (SecretStore).
"""
import copy
import ctypes
import hashlib
import json
import os
import secrets
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path

import sync_entities as E

COMPANION_URL = os.environ.get("FRAMEDECKS_COMPANION_URL", "https://framedecks.pages.dev").rstrip("/")
PUSH_BATCH = 200                      # sync_push: at most 200 changes and 2 MB a call
PUSH_BYTES = 1_800_000
QUIET_SECONDS = 3                     # after a save, wait for this much quiet before syncing
PULL_EVERY = 60                       # and pull at least this often
MAX_BACKOFF = 600
FRAME_KINDS = ("frame", "template")
LIST_KINDS = ("library_question", "library_verse", "member")
SETTINGS_KINDS = ("theme", "brand", "layout", "meeting")


def fingerprint(body):
    return None if body is None else hashlib.sha256(E.canon(body).encode("utf-8")).hexdigest()


def key_of(kind, rid):
    return f"{kind}/{rid}"


class Offline(Exception):
    """The cloud could not be reached (no internet, timeout, server busy). Try again later."""


class Refused(Exception):
    """The cloud said no: this PC was unlinked (revoked), or the request was wrong."""

    def __init__(self, message, code=""):
        super().__init__(message)
        self.code = code


# ---------- One sync round ----------

def _without_identity(body):
    """A Frame's content, ids and times aside: starter Frames made on two PCs compare equal."""
    if not isinstance(body, dict):
        return body
    return {k: v for k, v in body.items() if k not in ("id", "created", "modified")}


class Engine:
    """state: the kc-sync.json dictionary (changed in place). read() -> (plan, members). write(change) applies
    change(plan, members) -> (plan, members) to the latest saved plan and member list. computer_name names the
    copies made when the same Frame changed in two places."""

    def __init__(self, api, state, read, write, computer_name="this PC", member_authority="cloud"):
        self.api, self.state, self.read, self.write = api, state, read, write
        self.computer_name = computer_name
        # M-D2 (docs/migration-plan.md): "cloud" = the workspace is the source of the member list and this PC keeps a
        # copy it can rebuild; "pc" = the behaviour before (a lost member file is sent as deletions)
        self.member_authority = member_authority
        state.setdefault("cursor", 0)
        state.setdefault("known", {})
        state.setdefault("held", [])

    # -- helpers --
    def _local_records(self, plan, members):
        return {key_of(r["kind"], r["id"]): r for r in E.split(plan, members)["entities"]}

    @staticmethod
    def _live_frame(plan):
        live = plan.get("live") if isinstance(plan, dict) else None
        return str(live.get("scene") or "") if isinstance(live, dict) else ""

    def _pull_all(self):
        records, since = [], self.state["cursor"]
        while True:
            page = self.api.pull(since)
            records.extend(page.get("entities") or [])
            since = page.get("seq", since)
            if not page.get("more"):
                return records, since

    # -- the round --
    def run(self):
        """One round. Returns a summary: {"pulled", "applied", "held", "pushed", "conflicts"}."""
        known = self.state["known"]
        first_link = not known and self.state["cursor"] == 0
        rebuilt = self._rebuild_members() if self.member_authority == "cloud" else 0
        remote, cursor = self._pull_all()
        remote = self.state["held"] + remote          # held changes are tried again first
        self.state["held"] = []
        plan, members = self.read()
        local = self._local_records(plan, members)
        live = self._live_frame(plan)
        latest = {}
        for r in remote:                               # the newest version of each record wins within one pull
            latest[key_of(r["kind"], r["id"])] = r

        apply, copies, held, conflicts = {}, [], [], 0
        for k, r in latest.items():
            remote_hash = None if r.get("deleted") else fingerprint(r.get("body"))
            mine = local.get(k)
            mine_hash = fingerprint(mine["body"]) if mine else None
            agreed = known.get(k)
            changed_here = mine_hash != (agreed["hash"] if agreed else None)
            if mine_hash == remote_hash:                # already the same here (our own change coming back)
                known[k] = {"rev": r["rev"], "hash": remote_hash}
                continue
            if r["kind"] in FRAME_KINDS and r["id"] == live and live:
                held.append(r)                          # never change the Frame on screen; try again next round
                continue
            if not changed_here or mine is None:
                # Unchanged here, or deleted here while changed there (an edit beats a delete): take theirs.
                apply[k] = r
                known[k] = {"rev": r["rev"], "hash": remote_hash}
                continue
            if r.get("deleted"):                        # deleted there, changed here: keep ours, send it again
                known[k] = {"rev": r["rev"], "hash": None}
                continue
            conflicts += 1
            if first_link and agreed is None and r["kind"] in SETTINGS_KINDS:
                apply[k] = r                            # a setting this PC never synced takes the workspace's
                known[k] = {"rev": r["rev"], "hash": remote_hash}
            elif first_link and agreed is None and r["kind"] in LIST_KINDS:
                # The same id made on two PCs (starter questions, imported lists): theirs keeps the id, ours is added
                copies.append((r["kind"], copy.deepcopy(mine["body"])))
                apply[k] = r
                known[k] = {"rev": r["rev"], "hash": remote_hash}
            elif r["kind"] in FRAME_KINDS:
                copies.append((r["kind"], copy.deepcopy(mine["body"])))   # never lose a Frame: ours becomes a copy
                apply[k] = r
                known[k] = {"rev": r["rev"], "hash": remote_hash}
            elif r["kind"] == "order":
                ours = mine["body"]
                merged = copy.deepcopy(r["body"])
                for part in ("scenes", "questions", "verses", "members"):
                    have = list(merged.get(part) or [])
                    merged[part] = have + [i for i in (ours.get(part) or []) if i not in have]
                apply[k] = dict(r, body=merged)
                known[k] = {"rev": r["rev"], "hash": remote_hash}   # the merged order differs: it is sent next
            else:                                       # last writer wins: ours is sent on top of theirs
                known[k] = {"rev": r["rev"], "hash": remote_hash}

        if first_link:                                 # only against records that arrive now, never held ones
            arriving = {k: r for k, r in latest.items() if r not in held}
            self._drop_duplicate_starters(local, arriving, apply)
        if apply or copies:
            self.write(lambda p, m: self._apply(p, m, apply, copies))
        self.state["held"] = held
        self.state["cursor"] = cursor
        pushed = self._push()
        return {"pulled": len(remote), "applied": len(apply), "held": len(held), "pushed": pushed,
                "conflicts": conflicts, "membersRebuilt": rebuilt}

    def _rebuild_members(self):
        """The member file is gone (deleted, unreadable, a fresh data folder: read() gives None, not []) while this PC
        had agreed members with the workspace: fill it again from the workspace instead of sending every person as
        deleted. A list emptied on purpose ([]) is an edit and goes up as before. Returns how many came back."""
        known = self.state["known"]
        _, members = self.read()
        if members is not None or not any(k.startswith("member/") and v.get("hash") for k, v in known.items()):
            return 0
        latest, since = {}, 0
        while True:                                   # the whole workspace, not just what changed since the cursor
            page = self.api.pull(since)
            for r in page.get("entities") or []:
                latest[key_of(r["kind"], r["id"])] = r
            since = page.get("seq", since)
            if not page.get("more"):
                break
        people = {r["id"]: r for r in latest.values() if r["kind"] == "member" and not r.get("deleted")}
        order = latest.get("order/order")
        listed = [i for i in ((order or {}).get("body") or {}).get("members") or [] if i in people]
        ids = listed + [i for i in people if i not in listed]
        bodies = [copy.deepcopy(people[i]["body"]) for i in ids]
        self.write(lambda p, m: (p, bodies))
        for k in [k for k in known if k.startswith("member/")]:
            del known[k]
        for i in ids:
            known[key_of("member", i)] = {"rev": people[i]["rev"], "hash": fingerprint(people[i]["body"])}
        print(f"Sync: the member list was missing on this PC; {len(ids)} people restored from the workspace")
        return len(ids)

    def _drop_duplicate_starters(self, local, latest, apply):
        """First link: a Frame or person here with the same content as one in the workspace (ids and times aside),
        such as the starter Frames every PC makes, is not added twice. Any difference and both are kept."""
        for kinds in (FRAME_KINDS, ("member",)):
            theirs = {E.canon(_without_identity(r["body"])) for r in latest.values()
                      if r["kind"] in kinds and not r.get("deleted")}
            for k, mine in local.items():
                if mine["kind"] in kinds and k not in latest and E.canon(_without_identity(mine["body"])) in theirs:
                    apply[k] = {"kind": mine["kind"], "id": mine["id"], "deleted": True, "body": None}

    def _apply(self, plan, members, apply, copies):
        parts = E.split(plan, members)
        records = {key_of(r["kind"], r["id"]): r for r in parts["entities"]}
        for k, r in apply.items():
            if r.get("deleted"):
                records.pop(k, None)
            else:
                records[k] = {"kind": r["kind"], "id": r["id"], "body": copy.deepcopy(r["body"])}
        order = records.get("order/order")
        lists = {"frame": "scenes", "template": "scenes", "library_question": "questions", "library_verse": "verses",
                 "member": "members"}
        for kind, body in copies:
            if kind in FRAME_KINDS:
                new_id = "sc_" + secrets.token_hex(4)
                body["name"] = f"{body.get('name') or 'Frame'} (from {self.computer_name})"[:80]
                kind = "template" if body.get("tpl") else "frame"
            else:
                new_id = (body.get("id") or "i") + "-" + secrets.token_hex(3)
            body["id"] = new_id
            records[key_of(kind, new_id)] = {"kind": kind, "id": new_id, "body": body}
            if order:
                order["body"].setdefault(lists[kind], []).append(new_id)
        return E.join(list(records.values()), parts["local"])

    def _push(self):
        known = self.state["known"]
        plan, members = self.read()
        local = self._local_records(plan, members)
        held_keys = {key_of(r["kind"], r["id"]) for r in self.state["held"]}
        changes = []
        for k, r in local.items():
            if k in held_keys:
                continue
            agreed = known.get(k)
            if fingerprint(r["body"]) != (agreed["hash"] if agreed else None):
                changes.append({"kind": r["kind"], "id": r["id"], "baseRev": agreed["rev"] if agreed else 0,
                                "deleted": False, "body": r["body"]})
        for k, agreed in known.items():
            if k not in local and agreed["hash"] is not None and k not in held_keys:
                kind, rid = k.split("/", 1)
                changes.append({"kind": kind, "id": rid, "baseRev": agreed["rev"], "deleted": True})
        sent = 0
        for batch in self._batches(changes):
            answer = self.api.push(batch)
            by_key = {key_of(c["kind"], c["id"]): c for c in batch}
            for result in answer.get("results") or []:
                k = key_of(result["kind"], result["id"])
                change = by_key.get(k)
                if change is None:
                    continue
                body_hash = None if change.get("deleted") else fingerprint(change.get("body"))
                if result["status"] == "ok":
                    known[k] = {"rev": result["rev"], "hash": body_hash}
                    sent += 1
                elif result["status"] == "conflict":
                    current = result.get("current") or {}
                    current_hash = None if current.get("deleted") else fingerprint(current.get("body"))
                    if current_hash == body_hash:       # our earlier push did land; its answer was lost
                        known[k] = {"rev": current.get("rev", 0), "hash": body_hash}
                        sent += 1
                    # otherwise it changed there meanwhile: the next pull brings it and the rules above decide
        return sent

    @staticmethod
    def _batches(changes):
        batch, size = [], 0
        for c in changes:
            n = len(E.canon(c))
            if batch and (len(batch) >= PUSH_BATCH or size + n > PUSH_BYTES):
                yield batch
                batch, size = [], 0
            batch.append(c)
            size += n
        if batch:
            yield batch


# ---------- The cloud (Supabase REST, called with the public anon key and this PC's key) ----------

class CloudApi:
    def __init__(self, url, anon_key, organization_id=None, computer_key=None, timeout=20):
        self.url, self.anon_key = url.rstrip("/"), anon_key
        self.organization_id, self.computer_key, self.timeout = organization_id, computer_key, timeout

    def _rpc(self, name, args):
        headers = {"apikey": self.anon_key, "Content-Type": "application/json", "Accept": "application/json"}
        if self.computer_key:
            headers["x-framedecks-computer"] = self.computer_key
        req = urllib.request.Request(f"{self.url}/rest/v1/rpc/{name}", data=json.dumps(args).encode("utf-8"),
                                     headers=headers, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as res:
                return json.loads(res.read().decode("utf-8") or "null")
        except urllib.error.HTTPError as e:
            try:
                detail = json.loads(e.read().decode("utf-8") or "{}")
            except ValueError:
                detail = {}
            if e.code >= 500 or e.code == 429:
                raise Offline(detail.get("message") or f"The cloud answered {e.code}")
            raise Refused(detail.get("message") or f"The cloud answered {e.code}", str(detail.get("code") or e.code))
        except (urllib.error.URLError, OSError, TimeoutError, ValueError) as e:
            raise Offline(str(getattr(e, "reason", e)))

    def pull(self, since):
        return self._rpc("sync_pull", {"org": self.organization_id, "since": since, "max_rows": 500})

    def push(self, changes):
        return self._rpc("sync_push", {"org": self.organization_id, "changes": changes})

    def link_start(self, name, key_hash):
        return self._rpc("computer_link_start", {"computer_name": name, "key_hash": key_hash})

    def link_poll(self, key):
        return self._rpc("computer_link_poll", {"key": key})

    def revoke(self, computer_id):
        return self._rpc("computer_revoke", {"computer": computer_id})


def companion_config(timeout=10):
    """The cloud's address and public key, from the companion (it holds them; nothing secret is in this program)."""
    try:
        with urllib.request.urlopen(f"{COMPANION_URL}/api/sync-config", timeout=timeout) as res:
            data = json.loads(res.read().decode("utf-8"))
    except (urllib.error.URLError, OSError, ValueError) as e:
        raise Offline(f"Could not reach {COMPANION_URL}: {getattr(e, 'reason', e)}")
    if not isinstance(data, dict) or not str(data.get("url", "")).startswith("https://") or not data.get("anonKey"):
        raise Offline("The companion has no cloud set up yet")
    return {"url": data["url"], "anonKey": data["anonKey"]}


# ---------- Where the computer key is kept ----------

class SecretStore:
    """Windows Credential Manager (the same place Windows keeps saved passwords), through ctypes. On other systems
    (development and the tests) a file next to the sync state, readable only by its owner."""

    TARGET = "FRAMEDECKS/computer-key"

    def __init__(self, fallback_file, target=None):
        self.fallback = Path(fallback_file)
        self.TARGET = target or self.TARGET          # another secret (the ESV key) under its own name
        # FRAMEDECKS_SECRET_STORE=file: the tests use the file on Windows too (CI machines have no usable vault)
        self.windows = os.name == "nt" and os.environ.get("FRAMEDECKS_SECRET_STORE") != "file"

    def get(self):
        if not self.windows:
            try:
                return self.fallback.read_text(encoding="utf-8").strip() or None
            except OSError:
                return None
        cred = ctypes.c_void_p()
        if not ctypes.windll.advapi32.CredReadW(self.TARGET, 1, 0, ctypes.byref(cred)):
            return None
        try:
            c = ctypes.cast(cred, ctypes.POINTER(_CREDENTIAL)).contents
            return ctypes.string_at(c.CredentialBlob, c.CredentialBlobSize).decode("utf-8")
        finally:
            ctypes.windll.advapi32.CredFree(cred)

    def set(self, value):
        if not self.windows:
            self.fallback.parent.mkdir(parents=True, exist_ok=True)
            fd = os.open(str(self.fallback), os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                f.write(value)
            return
        blob = value.encode("utf-8")
        buffer = ctypes.create_string_buffer(blob, len(blob))   # kept alive until CredWriteW has copied it
        c = _CREDENTIAL()
        c.Type = 1                                   # CRED_TYPE_GENERIC
        c.TargetName = self.TARGET
        c.CredentialBlobSize = len(blob)
        c.CredentialBlob = ctypes.cast(buffer, ctypes.POINTER(ctypes.c_ubyte))
        c.Persist = 2                                # CRED_PERSIST_LOCAL_MACHINE: this Windows user on this PC
        c.UserName = "FRAMEDECKS"
        if not ctypes.windll.advapi32.CredWriteW(ctypes.byref(c), 0):
            raise OSError("Windows Credential Manager refused to store the key")

    def delete(self):
        if not self.windows:
            try:
                self.fallback.unlink()
            except OSError:
                pass
            return
        ctypes.windll.advapi32.CredDeleteW(self.TARGET, 1, 0)


if os.name == "nt":
    from ctypes import wintypes

    class _CREDENTIAL(ctypes.Structure):
        _fields_ = [("Flags", wintypes.DWORD), ("Type", wintypes.DWORD), ("TargetName", wintypes.LPWSTR),
                    ("Comment", wintypes.LPWSTR), ("LastWritten", wintypes.FILETIME),
                    ("CredentialBlobSize", wintypes.DWORD), ("CredentialBlob", ctypes.POINTER(ctypes.c_ubyte)),
                    ("Persist", wintypes.DWORD), ("AttributeCount", wintypes.DWORD), ("Attributes", ctypes.c_void_p),
                    ("TargetAlias", wintypes.LPWSTR), ("UserName", wintypes.LPWSTR)]
else:
    _CREDENTIAL = None


# ---------- The background service ----------

class Service:
    """state_file: kc-sync.json. read/write: as for Engine, against the program's saved plan and member list.
    make_api(config, organization_id, key) builds the cloud client (the tests pass a stand-in)."""

    def __init__(self, state_file, secrets_store, read, write, computer_name, make_api=None, config_source=None,
                 member_authority=None):
        self.member_authority = member_authority or (lambda: "cloud")   # read each round (an app setting)
        self.file = Path(state_file)
        self.secrets = secrets_store
        self.read, self.write, self.computer_name = read, write, computer_name
        self.make_api = make_api or (lambda cfg, org, key: CloudApi(cfg["url"], cfg["anonKey"], org, key))
        self.config_source = config_source or companion_config
        self.lock = threading.Lock()
        self.wake = threading.Event()
        self.stopping = False
        self.thread = None
        self.state = self._load()
        self.status = {"state": "linked" if self.state.get("link") else "unlinked", "lastSync": None, "error": None}
        self.pending = None                          # a link waiting for its code to be typed in the companion
        self._due = 0.0                               # when the next round is due
        self._retry_at = 0.0                          # while offline: not before this
        self.poll_every = 3.0                         # seconds between "was the code approved?" questions

    # -- the state file --
    def _load(self):
        try:
            data = json.loads(self.file.read_text(encoding="utf-8"))
            return data if isinstance(data, dict) else {}
        except (OSError, ValueError):
            return {}

    def _save(self):
        tmp = self.file.with_suffix(".tmp")
        tmp.write_text(json.dumps(self.state, indent=1, ensure_ascii=False), encoding="utf-8")
        os.replace(tmp, self.file)

    # -- what Settings shows --
    def info(self):
        link = self.state.get("link") or {}
        out = {"state": self.status["state"], "workspace": link.get("organizationName"), "linkedAt": link.get("linkedAt"),
               "lastSync": self.status["lastSync"], "error": self.status["error"], "companion": COMPANION_URL,
               "held": len(self.state.get("held") or [])}
        if self.pending:
            out.update(code=self.pending["code"], expiresAt=self.pending["expiresAt"])
        return out

    # -- linking --
    def link_start(self):
        """Makes this PC's key, keeps it, and asks the cloud for a code to type into the companion."""
        with self.lock:
            if self.state.get("link"):
                return self.info()
            config = self.config_source()
            key = secrets.token_urlsafe(32)
            api = self.make_api(config, None, None)
            code = api.link_start(self.computer_name, hashlib.sha256(key.encode("utf-8")).hexdigest())
            self.pending = {"code": code, "key": key, "config": config, "expiresAt": time.time() + 600}
            self.status.update(state="waiting", error=None)
        threading.Thread(target=self._wait_for_approval, daemon=True).start()
        return self.info()

    def _wait_for_approval(self):
        while not self.stopping:
            pending = self.pending
            if not pending:
                return
            if time.time() > pending["expiresAt"]:
                self.pending = None
                self.status.update(state="unlinked", error="The code expired. Choose Link again for a new one.")
                return
            try:
                answer = self.make_api(pending["config"], None, None).link_poll(pending["key"])
            except (Offline, Refused):
                answer = None
            if answer and answer.get("status") == "approved":
                self._finish_link(pending, answer)
                return
            time.sleep(self.poll_every)

    def _finish_link(self, pending, answer):
        with self.lock:
            self.secrets.set(pending["key"])
            self.state = {"link": {"computerId": answer["computerId"], "organizationId": answer["organizationId"],
                                   "organizationName": answer.get("organizationName"), "linkedAt": time.time()},
                          "cloud": pending["config"], "cursor": 0, "known": {}, "held": []}
            self._save()
            self.pending = None
            self.status.update(state="linked", error=None)
        self.start()
        self.poke(0)

    def link_cancel(self):
        self.pending = None
        if not self.state.get("link"):
            self.status.update(state="unlinked", error=None)
        return self.info()

    def unlink(self):
        """Stops syncing, tells the cloud to forget this PC's key when online, and deletes the key here. The plan on
        this PC stays exactly as it is."""
        with self.lock:
            link, cloud, key = self.state.get("link"), self.state.get("cloud"), self.secrets.get()
            if link and cloud and key:
                try:
                    self.make_api(cloud, link["organizationId"], key).revoke(link["computerId"])
                except (Offline, Refused):
                    pass                              # an admin can still remove it in the companion
            self.secrets.delete()
            self.state = {}
            self._save()
            self.status.update(state="unlinked", lastSync=None, error=None)
        return self.info()

    # -- syncing --
    def start(self):
        if self.thread and self.thread.is_alive():
            return
        if not self.state.get("link"):
            return
        self.stopping = False
        self.thread = threading.Thread(target=self._loop, name="FRAMEDECKS sync", daemon=True)
        self.thread.start()

    def stop(self):
        self.stopping = True
        self.wake.set()

    def poke(self, delay=QUIET_SECONDS):
        """Something was saved: sync after a few quiet seconds (but not before an offline wait is over)."""
        self._due = max(time.time() + delay, self._retry_at)
        self.wake.set()

    def sync_once(self):
        with self.lock:
            link, cloud, key = self.state.get("link"), self.state.get("cloud"), self.secrets.get()
            if not (link and cloud and key):
                self.status.update(state="unlinked")
                return None
            engine = Engine(self.make_api(cloud, link["organizationId"], key), self.state, self.read, self.write,
                            self.computer_name, self.member_authority())
            try:
                summary = engine.run()
            finally:
                self._save()                          # keep what was agreed, even when a later batch failed
            self.status.update(state="linked", lastSync=time.time(), error=None)
            return summary

    def _loop(self):
        backoff = 0
        self._due = time.time()
        while not self.stopping and self.state.get("link"):
            self.wake.wait(timeout=max(0.2, self._due - time.time()))
            self.wake.clear()
            if self.stopping:
                return
            if time.time() < self._due:
                continue                              # more saves are coming, or still waiting after going offline
            try:
                self.sync_once()
                backoff = 0
                self._retry_at = 0.0
                self._due = time.time() + PULL_EVERY
                continue
            except Offline as e:
                backoff = min(MAX_BACKOFF, max(30, backoff * 2))
                self.status.update(error=f"Offline: {e}. Changes wait on this PC and go up later.")
            except Refused as e:
                if e.code == "42501":                 # the cloud no longer knows this PC's key: it was unlinked
                    self.secrets.delete()
                    self.state = {}
                    self._save()
                    self.status.update(state="unlinked", error="This PC was disconnected from the workspace.")
                    return
                backoff = min(MAX_BACKOFF, max(60, backoff * 2))
                self.status.update(error=str(e))
            except Exception as e:                   # never let sync stop the program
                backoff = min(MAX_BACKOFF, max(60, backoff * 2))
                self.status.update(error=f"Sync problem: {e}")
            self._retry_at = self._due = time.time() + backoff
