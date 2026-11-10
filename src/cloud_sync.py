"""FrameDecks - syncing service plans with the workspace in the cloud (design: docs/architecture/metadata-sync.md).

Runs in the background only when this PC is linked to a workspace. It never sits on the path of a page, the phone
remote or the camera: presenting works exactly as without it, online or not.

    Engine        one sync round: pull what changed elsewhere, apply it (never to the live Frame), push what changed
                  here. Plain Python on dictionaries, tested against a stand-in cloud (tests/test_cloud_sync.py).
    CloudApi      the Supabase calls over HTTPS (urllib, no extra package): sync_pull / sync_push and linking.
    Service       the background thread, linking, unlinking, adding devices (26.11.12 Scan to join) and the status
                  shown in Settings > Sync.

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
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

import first_sync as FS
import sync_entities as E

# The website (docs/deployment/cloudflare-domains.md): framedecks.com is the one address. The Cloudflare Pages address
# answers too and is tried second, so a PC still links while framedecks.com is being set up or cannot be reached.
_COMPANION_ENV = os.environ.get("FRAMEDECKS_COMPANION_URL", "").rstrip("/")
COMPANION_URL = _COMPANION_ENV or "https://framedecks.com"
COMPANION_FALLBACKS = () if _COMPANION_ENV else ("https://framedecks.pages.dev",)
# Cloudflare (the website's host) answers 403 to Python's default "Python-urllib" identity, so every request says who it is
USER_AGENT = "FrameDecks (Windows; +https://framedecks.com)"
PUSH_BATCH = 200                      # sync_push: at most 200 changes and 2 MB a call
PUSH_BYTES = 1_800_000
QUIET_SECONDS = 3                     # after a save, wait for this much quiet before syncing
PULL_EVERY = 60                       # and pull at least this often
GRANT_SECONDS = 120                   # 26.11.26: Connect this PC from the website (0021: 2 minutes, once)
INVITE_SECONDS = 120                  # 26.11.12: an Add a device / Invite someone code (0018: 2 minutes, once)
MAX_BACKOFF = 600
UNDO_DAYS = 7                          # 26.11.36 Undo this connection: how long after the first sync
FRAME_KINDS = ("frame", "template")
MASS_DELETE_FRAMES = 3      # all Frames gone at once (at least this many): restore from the workspace, never delete
LIST_KINDS = ("library_question", "library_verse", "member")
SETTINGS_KINDS = ("theme", "brand", "layout", "meeting")
OVERWRITTEN_MAX, OVERWRITTEN_DAYS, OVERWRITTEN_BODY_MAX = 50, 90, 64 * 1024
# 7.1 what the audience sees of the settings: changed only while nothing is on screen, so a look never jumps mid-sentence
LOOK_KEYS = ("layout/look", "brand/brand", "layout/layout", "theme/cards")


def on_screen(plan):
    """Something the audience can see: a card, or Content of the live Frame (also used by the updater)."""
    plan = plan if isinstance(plan, dict) else {}
    if any(isinstance(plan.get(k), dict) and plan[k].get("visible") for k in ("verse", "question", "birthday")):
        return True
    live = plan.get("live") if isinstance(plan.get("live"), dict) else {}
    on = live.get("on") if isinstance(live.get("on"), dict) else {}
    return any(bool(v) for v in on.values())


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
        # M-D2 (docs/project/history/migration-plan.md): "cloud" = the workspace is the source of the member list and this PC keeps a
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

    # -- 26.11.36 the first sync, planned and shown before anything changes (src/first_sync.py) --
    def preview(self, mode="keep"):
        """What the first sync would do, in the dialog's words. Reads only: nothing is written, the cursor stays."""
        records, _ = self._pull_all()
        latest = {}
        for r in records:
            latest[key_of(r["kind"], r["id"])] = r
        plan, members = self.read()
        local = self._local_records(plan, members)
        out = FS.preview(FS.plan(local, latest, mode))
        out["here"] = len(FS.meetings_of((local.get("meeting/meeting") or {}).get("body")))
        return out

    def sync_preview(self):
        """26.11.41 the Frames panel's Sync: what Sync now would change, Frame by Frame, before anything does. Reads
        only (nothing written, the cursor stays). {"in": [{name, what, held}], "out": [{name, what}], "both": [names],
        "same": [names], "otherIn", "otherOut", "empty"}; what: "new" | "changed" | "removed"."""
        records, _ = self._pull_all()
        known = self.state["known"]
        latest = {}
        for r in list(self.state["held"]) + records:
            latest[key_of(r["kind"], r["id"])] = r
        plan, members = self.read()
        local = self._local_records(plan, members)
        live = self._live_frame(plan)
        arriving = {k: r for k, r in latest.items() if k not in local}
        dup = {}
        self._drop_duplicate_starters(local, arriving, dup, (FRAME_KINDS,))
        out = {"in": [], "out": [], "both": [], "same": [], "otherIn": 0, "otherOut": 0}
        settled = set()
        for k, r in latest.items():
            mine = local.get(k)
            remote_hash = None if r.get("deleted") else fingerprint(r.get("body"))
            mine_hash = fingerprint(mine["body"]) if mine else None
            if remote_hash == mine_hash:
                settled.add(k)
                continue
            agreed = known.get(k)
            changed_here = mine is not None and mine_hash != (agreed["hash"] if agreed else None)
            frame = r["kind"] in FRAME_KINDS
            if not frame:
                out["otherIn"] += 1
                settled.add(k)
                continue
            name = record_name(r, mine)
            if changed_here and not r.get("deleted"):
                out["both"].append(name)                  # the website's kept, this PC's kept as a copy
                settled.add(k)
                continue
            if r.get("deleted"):
                if mine is None:
                    settled.add(k)
                    continue
                if changed_here:                          # changed here, deleted there: ours goes up again
                    continue
                what = "removed"
            else:
                what = "new" if mine is None else "changed"
            out["in"].append({"name": name, "what": what, "held": bool(live and r["id"] == live and mine is not None)})
            settled.add(k)
        for k, mine in local.items():
            if k in settled or k in dup:
                continue
            agreed = known.get(k)
            if fingerprint(mine["body"]) == (agreed["hash"] if agreed else None):
                continue
            if mine["kind"] in FRAME_KINDS:
                out["out"].append({"name": record_name(mine), "what": "changed" if agreed else "new"})
            else:
                out["otherOut"] += 1
        for k, agreed in known.items():
            if k not in local and agreed.get("hash") is not None and k not in latest:
                kind, rid = k.split("/", 1)
                if kind in FRAME_KINDS:
                    out["out"].append({"name": "A Frame removed here", "what": "removed"})
                else:
                    out["otherOut"] += 1
        out["same"] = [record_name(local[k]) for k in dup]
        out["empty"] = not (out["in"] or out["out"] or out["both"] or out["otherIn"] or out["otherOut"])
        for part in ("in", "out"):
            out[part] = out[part][:200]
        return out

    def _prepare_first(self, plan, members, fp):
        """This PC's plan made ready for the first sync: Frames already in the workspace taken out (the workspace's
        arrive), this PC's own meetings filed under their own (unique) names with fresh ids where the workspace uses the
        same ones, list items it already has taken out, and the meeting list made the workspace's plus this PC's."""
        parts = E.split(plan, members)
        records = {key_of(r["kind"], r["id"]): r for r in parts["entities"]}
        for k in list(fp["dropLocal"]) + list(fp["lists"]["drop"]):
            records.pop(k, None)
        order = (records.get("order/order") or {}).get("body")
        for k in fp["newIds"]:
            r = records.pop(k, None)
            if not r:
                continue
            new_id = "sc_" + secrets.token_hex(4)
            if order and isinstance(order.get("scenes"), list):
                order["scenes"] = [new_id if i == r["id"] else i for i in order["scenes"]]
            body = copy.deepcopy(r["body"])
            body["id"] = new_id
            group = fp["regroup"].get(k)
            if group is not None:
                body["group"] = group
            records[key_of(r["kind"], new_id)] = {"kind": r["kind"], "id": new_id, "body": body}
        for k, group in fp["regroup"].items():
            if k in records and k not in fp["newIds"]:
                records[k]["body"]["group"] = group
        meeting = copy.deepcopy(fp.get("remoteMeeting") or (records.get("meeting/meeting") or {}).get("body") or {})
        if len(fp["meetings"]) > 1 or isinstance(meeting.get("meetings"), list):
            meeting["meetings"] = copy.deepcopy(fp["meetings"])
        records["meeting/meeting"] = {"kind": "meeting", "id": "meeting", "body": meeting}
        return E.join(list(records.values()), parts["local"])

    # -- the round --
    def run(self, first_mode=None):
        """One round. Returns a summary: {"pulled", "applied", "held", "pushed", "conflicts"}. first_mode: the
        leader's choice for meetings changed in both places on the first sync (src/first_sync.py MODES)."""
        known = self.state["known"]
        first_link = not known and self.state["cursor"] == 0
        # The plan here was lost or replaced (a damaged file at start-up, or every Frame gone at once): this round takes
        # the workspace's version of everything it holds, instead of sending deletions for it (production audit H1)
        adopt = bool(self.state.pop("adopt", False))
        rebuilt = self._rebuild_members() if self.member_authority == "cloud" else 0
        remote, cursor = self._pull_all()
        remote = self.state["held"] + remote          # held changes are tried again first
        self.state["held"] = []
        plan, members = self.read()
        local = self._local_records(plan, members)
        live = self._live_frame(plan)
        showing = on_screen(plan)
        latest = {}
        for r in remote:                               # the newest version of each record wins within one pull
            latest[key_of(r["kind"], r["id"])] = r
        fp = FS.plan(local, latest, first_mode or "keep") if first_link and not adopt else None
        keep_ours = set()
        if fp:                                         # 26.11.36 the meeting is the unit; what exists is skipped
            fp["remoteMeeting"] = (latest.get("meeting/meeting") or {}).get("body")
            self.write(lambda p, m: self._prepare_first(p, m, fp))
            plan, members = self.read()
            local = self._local_records(plan, members)
            keep_ours = {"meeting/meeting"} | set(fp["preferLocal"]) | set(fp["deleteRemote"])

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
            if k in keep_ours:                          # 26.11.36 the first sync decided: ours goes up (or theirs goes)
                known[k] = {"rev": r["rev"], "hash": remote_hash}
                continue
            if r["kind"] in FRAME_KINDS and r["id"] == live and live and mine is not None:
                held.append(r)                          # never change the Frame on screen; try again next round
                continue
            if k in LOOK_KEYS and showing:
                held.append(r)                          # the look waits until the screen is clear
                continue
            if adopt:                                   # restoring from the workspace: its version wins, no copies
                apply[k] = r
                known[k] = {"rev": r["rev"], "hash": remote_hash}
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
                self._keep_overwritten(r)               # 9.3 (audit L12): theirs is kept on this PC as well
                known[k] = {"rev": r["rev"], "hash": remote_hash}

        arriving = {k: r for k, r in latest.items() if r not in held}   # only records that arrive now, never held ones
        if first_link:
            self._drop_duplicate_starters(local, arriving, apply)
        elif not adopt:                                 # 26.11.41 the same new Frame made in both places: kept once
            self._drop_duplicate_starters(local, arriving, apply, (FRAME_KINDS,))
        if fp:                                         # a member already there gets this PC's missing details
            for k, body in fp["lists"]["fill"].items():
                if k in latest and k not in [key_of(x["kind"], x["id"]) for x in held]:
                    apply[k] = dict(latest[k], body=copy.deepcopy(body))
        if apply or copies:
            self.write(lambda p, m: self._apply(p, m, apply, copies))
        self.state["held"] = held
        self.state["cursor"] = cursor
        undo = self._undo_record(latest) if fp is not None or first_link else None
        pushed = self._push()
        if undo is not None:
            undo["created"] = [k for k in undo["created"] if (known.get(k) or {}).get("hash")]
            self.state["firstSync"] = undo
        # 26.11.12: what came from the website (a person's change, "user:<id>"; a PC's is "computer:<id>"), so the
        # program can say once "Updated from the website: Sunday Service". Nothing is said on the first link.
        website = []
        if not first_link and not adopt:
            for k, r in apply.items():
                if str(r.get("updatedBy") or "").startswith("user:"):
                    name = record_name(r, local.get(k))
                    if name not in website:
                        website.append(name)
        return {"pulled": len(remote), "applied": len(apply), "held": len(held), "pushed": pushed,
                "conflicts": conflicts, "membersRebuilt": rebuilt, "fromWebsite": website,
                "first": FS.preview(fp) if first_link and not adopt else None}

    def _undo_record(self, latest):
        """26.11.36 Undo this connection: what the first sync is about to create in the workspace, and the workspace's
        version of everything it is about to change or remove there, so it can all be put back."""
        known = self.state["known"]
        plan, members = self.read()
        local = self._local_records(plan, members)
        created = [k for k in local if k not in known]
        restore, size = {}, 0
        for k, agreed in known.items():
            r = latest.get(k)
            if not r or r.get("deleted") or r.get("body") is None:
                continue
            mine = local.get(k)
            if mine is not None and fingerprint(mine["body"]) == agreed.get("hash"):
                continue                                # left as the workspace has it
            n = len(E.canon(r["body"]))
            if size + n > PUSH_BYTES:
                break
            size += n
            restore[k] = {"kind": r["kind"], "id": r["id"], "body": copy.deepcopy(r["body"])}
        return {"at": time.time(), "created": created, "restore": restore}

    # 9.3 (audit L12): a list item, setting or order changed both here and elsewhere keeps this PC's version (it is
    # sent on top). The other version stays in the workspace's history for 30 days; this PC keeps it too, the latest
    # OVERWRITTEN_MAX for OVERWRITTEN_DAYS, in kc-sync.json ("overwritten"), so an edit is never lost unseen.
    def _keep_overwritten(self, r):
        now = time.time()
        kept = [o for o in self.state.get("overwritten") or [] if now - o.get("at", 0) < OVERWRITTEN_DAYS * 86400]
        body = r.get("body")
        if len(json.dumps(body, ensure_ascii=False)) > OVERWRITTEN_BODY_MAX:
            body = None                                 # too big to keep here; the workspace history still has it
        kept.append({"kind": r["kind"], "id": r["id"], "rev": r.get("rev"), "by": r.get("updatedBy") or "",
                     "at": now, "body": body})
        self.state["overwritten"] = kept[-OVERWRITTEN_MAX:]

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

    def _drop_duplicate_starters(self, local, latest, apply, kinds_list=(FRAME_KINDS, ("member",))):
        """First link: a Frame or person here with the same content as one in the workspace (ids and times aside),
        such as the starter Frames every PC makes, is not added twice. Any difference and both are kept.
        26.11.41 every round, for Frames: a Frame made here and never synced that arrives from the workspace as well
        (the same .frame file imported in both places) is kept once, as the workspace's."""
        for kinds in kinds_list:
            theirs = {E.canon(_without_identity(r["body"])) for k, r in latest.items()
                      if r["kind"] in kinds and not r.get("deleted") and k not in local}
            for k, mine in local.items():
                if (mine["kind"] in kinds and k not in latest and k not in self.state["known"]
                        and E.canon(_without_identity(mine["body"])) in theirs):
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
        gone = []
        for k, agreed in known.items():
            if k not in local and agreed["hash"] is not None and k not in held_keys:
                kind, rid = k.split("/", 1)
                gone.append({"kind": kind, "id": rid, "baseRev": agreed["rev"], "deleted": True})
        frames_gone = [c for c in gone if c["kind"] in FRAME_KINDS]
        frames_here = sum(1 for r in local.values() if r["kind"] in FRAME_KINDS)
        if frames_here == 0 and len(frames_gone) >= MASS_DELETE_FRAMES:
            # Every Frame vanished at once. Far more likely a lost or reset plan than a choice, and sending it would empty
            # the workspace and every other PC. Nothing is deleted there; the next round restores the Frames here.
            print(f"Sync: all {len(frames_gone)} Frames are missing on this PC; not deleting them in the workspace. "
                  "They are restored from the workspace (delete Frames on the website to remove them everywhere).",
                  flush=True)
            gone = [c for c in gone if c["kind"] not in FRAME_KINDS and c["kind"] != "order"]
            changes = [c for c in changes if c["kind"] != "order"]          # nor an emptied running order
            self.state["adopt"] = True
            self.state["cursor"] = 0
        changes += gone
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
        headers = {"apikey": self.anon_key, "Content-Type": "application/json", "Accept": "application/json",
                   "User-Agent": USER_AGENT}
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

    # 26.11.12 Scan to join (0018_scan_to_join.sql): the church PC adds devices with its own key
    def pc_invite_create(self, wanted):
        return self._rpc("pc_invite_create", {"wanted": wanted})

    def join_request_peek(self, code):
        return self._rpc("join_request_peek", {"code": code})

    # 26.11.26 joining without typing (0021_passwordless.sql)
    def pc_device_code_create(self):
        return self._rpc("pc_device_code_create", {})

    def grant_peek(self, code):
        return self._rpc("pc_grant_peek", {"code": code})

    def link_with_grant(self, code, name, key_hash):
        return self._rpc("pc_link_with_grant", {"code": code, "computer_name": name, "key_hash": key_hash})

    def pc_join_request_allow(self, code, wanted):
        return self._rpc("pc_join_request_allow", {"code": code, "wanted": wanted})

    # 26.11.23 the prayer requests wall (0019_prayer_wall.sql), with this PC's own key
    def pc_prayer_open(self, hours=4):
        return self._rpc("pc_prayer_open", {"hours": hours})

    def pc_prayer_close(self):
        return self._rpc("pc_prayer_close", {})

    def pc_prayer_take(self):
        return self._rpc("pc_prayer_take", {})

    # 26.11.24 members' phones (0020_member_room.sql), with this PC's own key
    def pc_room_open(self, hours=6):
        return self._rpc("pc_room_open", {"hours": hours})

    def pc_room_publish(self, screen, notes=None, set_notes=False):
        return self._rpc("pc_room_publish", {"screen": screen, "notes": notes, "set_notes": bool(set_notes)})

    def pc_room_close(self):
        return self._rpc("pc_room_close", {})

    # 26.11.33 quick responses and polls in the members' room (0022_room_polls.sql), with this PC's own key
    def pc_room_response_open(self, question, kind, options=None, show_results=False):
        return self._rpc("pc_room_response_open", {"question": question, "kind": kind, "options": options,
                                                   "show_results": bool(show_results)})

    def pc_room_response_close(self):
        return self._rpc("pc_room_response_close", {})

    def pc_room_response_results(self):
        return self._rpc("pc_room_response_results", {})

    def pc_devices(self):
        return self._rpc("pc_devices", {})

    def pc_device_remove(self, person):
        return self._rpc("pc_device_remove", {"person": person})


def _fetch_config(base, timeout):
    req = urllib.request.Request(f"{base}/api/sync-config",
                                 headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            data = json.loads(res.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        raise Offline(f"Could not reach {base}: the website answered {e.code} {e.reason}")
    except (urllib.error.URLError, OSError, ValueError) as e:
        raise Offline(f"Could not reach {base}: {getattr(e, 'reason', e)}")
    if not isinstance(data, dict) or not str(data.get("url", "")).startswith("https://") or not data.get("anonKey"):
        raise Offline("The companion has no cloud set up yet")
    return {"url": data["url"], "anonKey": data["anonKey"], "site": base}


# 9.10.3 the cloud's address and public key are built into the program (cloud_builtin.json, written by the Windows build
# from the repository secrets SUPABASE_URL / SUPABASE_ANON_KEY: tools/write_cloud_builtin.py), so linking a PC no
# longer needs the website to answer first. The website's /api/sync-config stays as the backup, and is the only source
# when FRAMEDECKS_COMPANION_URL points the program at another website (development, tests).
BUILTIN_FILE = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent)) / "cloud_builtin.json"


def public_key_ok(key):
    """A key the program may carry: the publishable (anon) key only, never a secret or service_role key."""
    key = str(key or "").strip()
    if not key or key.startswith("sb_secret_"):
        return False
    if key.count(".") == 2:                      # an older JWT-style key: its middle part says which role it is
        import base64
        try:
            part = key.split(".")[1]
            claims = json.loads(base64.urlsafe_b64decode(part + "=" * (-len(part) % 4)).decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            return False
        return isinstance(claims, dict) and claims.get("role") == "anon"
    return True


def builtin_config(path=None):
    """The address and publishable key built into this program, or None (a build without them, or anything odd)."""
    try:
        data = json.loads(Path(path or BUILTIN_FILE).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    if not isinstance(data, dict):
        return None
    url, key = str(data.get("url", "")).rstrip("/"), str(data.get("anonKey", "")).strip()
    if not url.startswith("https://") or not public_key_ok(key):
        return None
    return {"url": url, "anonKey": key, "site": COMPANION_URL}


def companion_config(timeout=10):
    """The cloud's address and public key. Built into the program (9.10.3); otherwise, or when the program is pointed
    at another website, asked from the website: framedecks.com first, then the fallback address (the first website's
    problem is the one reported). Both are public by design; nothing secret is in this program."""
    if not _COMPANION_ENV:
        built = builtin_config()
        if built:
            return built
    first = None
    for base in (COMPANION_URL, *COMPANION_FALLBACKS):
        try:
            return _fetch_config(base, timeout)
        except Offline as e:
            first = first or e
    raise first


def check_number(code):
    """10-99 from the link code: the website's /connect page shows the same number (hosted/src/lib/connect-link.ts), so a
    person can see the request in the browser came from this PC."""
    digest = hashlib.sha256(code.replace(" ", "").upper().encode("utf-8")).hexdigest()
    return int(digest[:4], 16) % 90 + 10


def connect_url(site, code, name):
    """The page that asks a signed-in owner or admin to allow this PC (6.13). The code rides in the fragment, after the
    #, so it never reaches a server log or a Referer header."""
    return f"{site.rstrip('/')}/connect#code={code}&name={urllib.parse.quote(name or 'A computer', safe='')}"


def join_url(site, code):
    """26.11.12 Scan to join: what the QR code on this PC carries. The phone's camera opens the website's /join page,
    which uses the code (the code rides in the fragment, after the #, so it never reaches a server log)."""
    return f"{site.rstrip('/')}/join#c={tidy_code(code)}"


def tidy_code(code):
    """A code as typed or scanned: letters and digits only, capitals (the cloud does the same: public.code_hash)."""
    return "".join(ch for ch in str(code or "") if ch.isascii() and ch.isalnum()).upper()[:32]


ROLES = ("admin", "member")


def _epoch(value, fallback):
    """The cloud's timestamp ("2026-11-12T10:00:00.123+00:00") as seconds since 1970, or the fallback."""
    from datetime import datetime
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).timestamp()
    except (TypeError, ValueError):
        return fallback


# What a record is called in "Updated from the website: ..." (Frames by their own name)
RECORD_WORDS = {"order": "Running order", "library_question": "Questions", "library_verse": "Scriptures",
                "theme": "Card looks", "brand": "Branding", "layout": "Layout", "meeting": "Meeting details",
                "member": "Members"}


def record_name(r, mine=None):
    """A short name for a record that changed: a Frame's name, the meeting's name, or what kind of thing it is."""
    body = r.get("body") if isinstance(r.get("body"), dict) else (mine or {}).get("body")
    body = body if isinstance(body, dict) else {}
    if r.get("kind") in FRAME_KINDS:
        return str(body.get("name") or "A Frame")[:60]
    if r.get("kind") == "meeting":
        return str(body.get("name") or body.get("title") or RECORD_WORDS["meeting"])[:60]
    return RECORD_WORDS.get(r.get("kind"), "Settings")


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
        self.busy = False                            # a round is running (8.2: "Syncing" in the header)
        self.offline = False                         # the last round could not reach the cloud
        self.pending = None                          # a link waiting to be allowed on the website
        self._due = 0.0                               # when the next round is due
        self._retry_at = 0.0                          # while offline: not before this
        self.poll_every = 1.5                         # while waiting: "was this PC allowed?" (connected ~2 s after Allow)
        self.next_pull = lambda: PULL_EVERY           # 9.11: live_push.Doorbell.sync_every (longer while listening or resting)
        self.update = None                            # 26.11.12: {"at", "names"} the last changes made on the website
        self.grant = None                             # 26.11.26: {"code", "team", "by", "at"} Connect this PC, asked
        self.first = None                             # 26.11.36: the first sync's preview, shown before anything changes
        self.backup_file = self.file.with_name("kc-sync-before.json")

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

    def adopt_workspace(self):
        """The plan on this PC was replaced (a damaged file at start-up): the next round reads the whole workspace again
        and takes its version, so nothing is deleted there. Does nothing on a PC that is not linked."""
        with self.lock:
            if not self.state.get("link"):
                return False
            self.state["cursor"] = 0
            self.state["adopt"] = True
            self._save()
            return True

    # -- what Settings shows --
    def info(self):
        link = self.state.get("link") or {}
        out = {"state": self.status["state"], "workspace": link.get("organizationName"), "linkedAt": link.get("linkedAt"),
               "lastSync": self.status["lastSync"], "error": self.status["error"], "companion": COMPANION_URL,
               "held": len(self.state.get("held") or []), "phase": self.phase(), "update": self.update,
               "computerName": self.computer_name}
        if self.state.get("firstPending"):              # 26.11.36 waiting for the leader's choice
            out["first"] = self.first or {"state": "checking"}
        elif self.first and self.first.get("state") == "done":
            out["firstDone"] = self.first.get("result")
        undo = self.undo_until()
        if undo:
            out["undoUntil"] = undo
        if self.pending:
            code = self.pending["code"]
            site = self.pending["config"].get("site") or COMPANION_URL
            # 26.11.12 Scan to join: the phone scans joinUrl (a QR code in Settings > Sync); connectUrl opens this
            # PC's own browser instead, as before
            out.update(code=code, expiresAt=self.pending["expiresAt"], check=check_number(code),
                       connectUrl=connect_url(site, code, self.computer_name), joinUrl=join_url(site, code),
                       expiresIn=max(0, round(self.pending["expiresAt"] - time.time())))
        g = self.grant
        if g and time.time() - g["at"] < GRANT_SECONDS and not self.state.get("link"):
            out["grant"] = {"team": g["team"], "by": g["by"]}     # never the code itself
        return out

    def phase(self):
        """8.2: one word for the header: "synced", "syncing", "offline", "failed" or "" (not linked)."""
        if self.status["state"] != "linked":
            return ""
        if self.busy:
            return "syncing"
        if self.offline:
            return "offline"
        return "failed" if self.status["error"] else "synced"

    # -- linking --
    def link_start(self):
        """Makes this PC's key, keeps it in memory, and asks the cloud for a code. Settings opens the website's /connect page
        with it (one click); typing the code under Service PCs still works."""
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
                self.status.update(state="unlinked", error="The code ran out after 10 minutes. Choose Add a device for a new one.")
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
                          "cloud": pending["config"], "cursor": 0, "known": {}, "held": [], "firstPending": True}
            self.first = None
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
            self.first = None
            try:
                self.backup_file.unlink()                 # 26.11.36 the first-sync backup goes with the connection
            except OSError:
                pass
            self.status.update(state="unlinked", lastSync=None, error=None)
        return self.info()

    # -- syncing --
    def start(self):
        if self.thread and self.thread.is_alive():
            return
        if not self.state.get("link"):
            return
        self.stopping = False
        self.thread = threading.Thread(target=self._loop, name="FrameDecks sync", daemon=True)
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
            mode = self.state.get("firstMode")
            if self.state.get("firstPending") and not mode:
                # 26.11.36 nothing changes until the leader has seen what the first sync will do
                if not self.first or self.first.get("state") != "ready":
                    prev = engine.preview()
                    if prev.get("empty"):              # an empty workspace: nothing to decide, this PC's plan goes up
                        self.state["firstMode"] = mode = "keep"
                    else:
                        self.first = dict(prev, state="ready")
                if not mode:
                    self.offline = False
                    self.status.update(state="linked", error=None)
                    return {"pulled": 0, "applied": 0, "held": 0, "pushed": 0, "conflicts": 0, "waiting": True}
            if mode:
                self._backup()
            self.busy = True
            try:
                summary = engine.run(mode)
            finally:
                self.busy = False
                self._save()                          # keep what was agreed, even when a later batch failed
            if mode:
                self.state.pop("firstPending", None)
                self.state.pop("firstMode", None)
                self.first = {"state": "done", "result": summary.get("first")}
                self._save()
            self.offline = False
            self.status.update(state="linked", lastSync=time.time(), error=None)
            if summary.get("fromWebsite"):             # said once by the main window (account.js)
                self.update = {"at": time.time(), "names": summary["fromWebsite"][:6]}
            return summary

    # -- 26.11.36 the first sync: the leader's choice, a backup before it, and Undo this connection --
    def first_choose(self, mode):
        """The leader has seen the preview: sync now, with this choice for meetings changed in both places."""
        if mode not in FS.MODES:
            raise Refused("Choose Keep both, Use the workspace's or Use this PC's.", "22023")
        with self.lock:
            if not self.state.get("firstPending"):
                return self.info()
            self.state["firstMode"] = mode
            self._save()
        return self.resync()

    def first_refresh(self):
        """Look again (the workspace changed while the preview was open)."""
        self.first = None
        self.poke(0)
        return self.info()

    def _backup(self):
        """This PC's plan and member list exactly as they were before the first sync (kc-sync-before.json)."""
        if self.backup_file.exists():
            return
        plan, members = self.read()
        tmp = self.backup_file.with_suffix(".tmp")
        tmp.write_text(json.dumps({"at": time.time(), "plan": plan, "members": members}, ensure_ascii=False), encoding="utf-8")
        os.replace(tmp, self.backup_file)

    def undo_until(self):
        f = self.state.get("firstSync") or {}
        until = (f.get("at") or 0) + UNDO_DAYS * 86400
        return until if f.get("at") and time.time() < until and self.backup_file.exists() else None

    def undo_connection(self):
        """Within 7 days of the first sync: what it created in the workspace is removed, what it changed or removed there
        is put back, this PC's plan and members go back to how they were, and this PC is disconnected."""
        if not self.undo_until():
            raise Refused("Undo is possible for 7 days after the first sync, on the PC that was connected.")
        with self.lock:
            link, cloud, key = self.state.get("link"), self.state.get("cloud"), self.secrets.get()
            f, known = self.state.get("firstSync") or {}, self.state.get("known") or {}
            api = self.make_api(cloud, link["organizationId"], key)
            changes = []
            for k in f.get("created") or []:
                agreed = known.get(k)
                if agreed and agreed.get("hash"):
                    kind, rid = k.split("/", 1)
                    changes.append({"kind": kind, "id": rid, "baseRev": agreed["rev"], "deleted": True})
            for k, r in (f.get("restore") or {}).items():
                agreed = known.get(k) or {"rev": 0}
                changes.append({"kind": r["kind"], "id": r["id"], "baseRev": agreed.get("rev", 0), "deleted": False,
                                "body": r["body"]})
            for batch in Engine._batches(changes):
                api.push(batch)                        # a record changed meanwhile answers "conflict" and is left as it is
            saved = json.loads(self.backup_file.read_text(encoding="utf-8"))
            self.write(lambda p, m: (saved.get("plan") or p, saved.get("members") if saved.get("members") is not None else m))
        out = self.unlink()
        try:
            self.backup_file.unlink()
        except OSError:
            pass
        return dict(out, undone=True)

    # -- 26.11.12 Scan to join: the church PC adds and removes devices with its own key --
    def _team(self):
        link, cloud, key = self.state.get("link"), self.state.get("cloud"), self.secrets.get()
        if not (link and cloud and key):
            raise Refused("This PC is not connected yet. Choose Add a device first.", "42501")
        return self.make_api(cloud, link["organizationId"], key), cloud.get("site") or COMPANION_URL

    # -- 26.11.26 Connect this PC from the website (0021): the program always asks before it uses the grant --
    def grant_offer(self, code):
        """The website's framedecks://connect link brought a one-time grant: look at it (which team, who sent it) and
        keep it for the question in the main window. Nothing is connected yet."""
        code = tidy_code(code)
        if len(code) != 8 or self.state.get("link"):
            return None
        answer = self.make_api(self.config_source(), None, None).grant_peek(code) or {}
        if answer.get("status") != "grant":
            self.grant = None
            return {"status": answer.get("status") or "unknown"}
        self.grant = {"code": code, "team": answer.get("team") or "your team", "by": answer.get("by"), "at": time.time()}
        return {"status": "grant", "team": self.grant["team"], "by": self.grant["by"]}

    def grant_accept(self):
        """Connect: this PC makes its key and joins the team the grant was for."""
        g, self.grant = self.grant, None
        if not g or time.time() - g["at"] >= GRANT_SECONDS:
            raise Refused("That request ran out. Choose Connect this PC on the website again.")
        with self.lock:
            if self.state.get("link"):
                return self.info()
            config = self.config_source()
            key = secrets.token_urlsafe(32)
            answer = self.make_api(config, None, None).link_with_grant(
                g["code"], self.computer_name, hashlib.sha256(key.encode("utf-8")).hexdigest()) or {}
        if answer.get("status") != "linked":
            raise Refused("That request ran out or was used. Choose Connect this PC on the website again.")
        self._finish_link({"key": key, "config": config}, answer)
        return self.info()

    def grant_decline(self):
        self.grant = None
        return self.info()

    def add_device(self):
        """26.11.26 Add a device: a code that signs the phone in as the person who connected this PC (no guest account,
        no approval). A PC connected by a device without an email (or before 0021) shows the Admin invite instead."""
        api, site = self._team()
        try:
            answer = api.pc_device_code_create() or {}
        except Refused:
            answer = {}
        code = tidy_code(answer.get("code"))
        if answer.get("status") != "ok" or not code:
            return dict(self.invite("admin"), who=None)
        return {"code": code, "role": "self", "who": answer.get("who"), "joinUrl": join_url(site, code),
                "expiresIn": INVITE_SECONDS, "expiresAt": time.time() + INVITE_SECONDS}

    def invite(self, role="admin"):
        """A code for a QR on this PC: the phone that scans it joins the team as Admin or Helper (member). It lasts
        2 minutes and works once."""
        if role not in ROLES:
            raise Refused("Choose Admin or Helper.", "22023")
        api, site = self._team()
        answer = api.pc_invite_create(role) or {}
        code = tidy_code(answer.get("code"))
        if not code:
            raise Refused("No code came back. Try again.")
        return {"code": code, "role": answer.get("role") or role, "joinUrl": join_url(site, code),
                "expiresIn": INVITE_SECONDS, "expiresAt": time.time() + INVITE_SECONDS}

    def allow_peek(self, code):
        """Allow a device: which device asked with this code, and how long ago ({"status": "pending" | "expired" |
        "unknown", "device", "ageSeconds"})."""
        code = tidy_code(code)
        if len(code) < 6:
            return {"status": "unknown"}
        api, _ = self._team()
        return api.join_request_peek(code) or {"status": "unknown"}

    def allow(self, code, role="member"):
        """Lets the device that shows this code into the team ({"status": "allowed" | "wrong", "device", "role"})."""
        if role not in ROLES:
            raise Refused("Choose Admin or Helper.", "22023")
        code = tidy_code(code)
        if len(code) < 6:
            return {"status": "wrong"}
        api, _ = self._team()
        return api.pc_join_request_allow(code, role) or {"status": "wrong"}

    def devices(self):
        """The team's Devices list (people's devices and PCs), and the names of devices that joined since the list
        was last looked at here ("joined"; nothing the first time)."""
        api, _ = self._team()
        rows = []
        for r in api.pc_devices() or []:
            if not isinstance(r, dict) or not r.get("id"):
                continue
            rows.append({"kind": r.get("kind") or "person", "id": str(r["id"]), "name": str(r.get("name") or "A device")[:80],
                         "role": r.get("role") or "member", "me": bool(r.get("is_me")),
                         "lastSeen": _epoch(r.get("last_seen_at"), None), "joined": _epoch(r.get("joined_at"), None)})
        with self.lock:
            seen = self.state.get("devicesSeen")
            joined = [] if seen is None else [r["name"] for r in rows if r["id"] not in seen and not r["me"]]
            ids = sorted(r["id"] for r in rows)
            if seen is None or sorted(seen) != ids:
                self.state["devicesSeen"] = ids
                self._save()
        return {"devices": rows, "joined": joined}

    def remove_device(self, person):
        """Takes a person's device out of the team (never the owner's: the cloud refuses that). PCs are removed by
        Disconnect on that PC, or on the website."""
        person = str(person or "").strip()
        if not person or len(person) > 64:
            raise Refused("Choose a device to remove.", "22023")
        api, _ = self._team()
        api.pc_device_remove(person)
        return self.devices()

    def frames_preview(self):
        """26.11.41 the Frames panel's Sync: what Sync now would change ({"preview": ...} or {"result": failed})."""
        with self.lock:
            link, cloud, key = self.state.get("link"), self.state.get("cloud"), self.secrets.get()
            if not (link and cloud and key):
                return {**self.info(), "result": {"outcome": "failed", "message": "This PC is not linked to a workspace yet. Settings → Sync links it."}}
            if self.state.get("firstPending"):
                return {**self.info(), "first": True}
            try:
                engine = Engine(self.make_api(cloud, link["organizationId"], key), self.state, self.read, self.write,
                                self.computer_name, self.member_authority())
                prev = engine.sync_preview()
            except Offline:
                return {**self.info(), "result": {"outcome": "failed", "message": "No internet right now. Presenting is not affected; try again when the PC is online."}}
            except Refused as e:
                return {**self.info(), "result": {"outcome": "failed", "message": f"Sync could not look: {e}"}}
            except Exception as e:                   # never let a button stop the program
                return {**self.info(), "result": {"outcome": "failed", "message": f"Sync could not look: {e}"}}
        return {**self.info(), "preview": prev}

    def resync(self):
        """8.4 Resync Linked PCs: one round now, whatever the timer says, and what it did in plain words
        ({"outcome": "complete" | "nochange" | "failed", "message"}). Automatic syncing carries on as before."""
        if not self.state.get("link"):
            return {**self.info(), "result": {"outcome": "failed", "message": "This PC is not linked to a workspace yet."}}
        try:
            summary = self.sync_once() or {}
        except Offline as e:
            self.offline = True
            self.status.update(error=f"Offline: {e}. Changes wait on this PC and go up later.")
            return {**self.info(), "result": {"outcome": "failed", "message": "Sync failed: no internet. Presenting is not affected; try again when the PC is online."}}
        except Refused as e:
            self.offline = False
            self.status.update(error=str(e))
            return {**self.info(), "result": {"outcome": "failed", "message": f"Sync failed: {e}"}}
        except Exception as e:                       # never let a button stop the program
            self.offline = False
            self.status.update(error=f"Sync problem: {e}")
            return {**self.info(), "result": {"outcome": "failed", "message": f"Sync failed: {e}"}}
        self._retry_at = 0.0
        self._due = time.time() + self.next_pull()
        came, went = summary.get("applied", 0), summary.get("pushed", 0)
        held, conflicts = summary.get("held", 0), summary.get("conflicts", 0)
        if not (came or went or held or conflicts):
            return {**self.info(), "result": {"outcome": "nochange", "message": "No changes found. This PC already has the latest plan."}}
        parts = []
        if came:
            parts.append(f"{came} change{'s' if came != 1 else ''} received")
        if went:
            parts.append(f"{went} sent")
        if held:
            parts.append(f"{held} waiting until the live Frame leaves the screen")
        if conflicts:
            parts.append(f"{conflicts} edited in two places (the latest kept)")
        return {**self.info(), "result": {"outcome": "complete", "message": "Sync complete: " + ", ".join(parts) + "."}}

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
                self._due = time.time() + self.next_pull()
                continue
            except Offline as e:
                backoff = min(MAX_BACKOFF, max(30, backoff * 2))
                self.offline = True
                self.status.update(error=f"Offline: {e}. Changes wait on this PC and go up later.")
            except Refused as e:
                if e.code == "42501":                 # the cloud no longer knows this PC's key: it was unlinked
                    self.secrets.delete()
                    self.state = {}
                    self._save()
                    self.status.update(state="unlinked", error="This PC was disconnected from the workspace.")
                    return
                backoff = min(MAX_BACKOFF, max(60, backoff * 2))
                self.offline = False
                self.status.update(error=str(e))
            except Exception as e:                   # never let sync stop the program
                backoff = min(MAX_BACKOFF, max(60, backoff * 2))
                self.offline = False
                self.status.update(error=f"Sync problem: {e}")
            self._retry_at = self._due = time.time() + backoff
