"""FrameDecks 26.11.36 - the first sync of a newly connected PC, planned before anything changes.

Until 26.11.35 the first sync merged by record: the workspace's meeting list replaced this PC's, so the PC's Frames fell
into the workspace's first meeting. Now the meeting is the unit, and every item is compared by its fingerprint first
(what is already in the workspace is skipped, never copied):

    same      the meeting is in both places with the same Frames: linked, nothing copied
    added     in both, and this PC only adds Frames to it (none edited): its new Frames join the meeting
    here      only on this PC: added to the workspace as its own meeting
    there     only in the workspace: arrives on this PC as its own meeting
    changed   in both, with different Frames: by the leader's choice
                keep       (default) both kept: this PC's becomes "<name> (this PC)"
                workspace  the workspace's version is used here (this PC's Frames are kept in the backup)
                pc         this PC's version is used everywhere (the workspace keeps its history 30 days)

Members (by email or phone), library verses (by reference and version) and questions (by their words) that are already
in the workspace are not added twice; a member's missing details are filled in from this PC. Frames from two different
meetings are never mixed. The rules for meetings are the same as app/js/store.js (meetingsOf, meetingOfScene)."""
import copy
import json
import re

MODES = ("keep", "workspace", "pc")
SUFFIX = " (this PC)"


def canon(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def _s(v, n):
    return str("" if v is None else v)[:n]


def meetings_of(meeting):
    """The meetings of a meeting block: its list, or one made from its title, date and notes (store.js meetingsOf)."""
    m = meeting if isinstance(meeting, dict) else {}
    out, ids, names = [], set(), set()
    for e in m.get("meetings") if isinstance(m.get("meetings"), list) else []:
        if not isinstance(e, dict) or len(out) >= 100:
            continue
        name, mid = _s(e.get("name"), 60).strip(), _s(e.get("id"), 40).strip()
        if not name or not mid or mid in ids or name.lower() in names:
            continue
        ids.add(mid)
        names.add(name.lower())
        out.append({"id": mid, "name": name, "date": _s(e.get("date"), 40), "notes": _s(e.get("notes"), 2000)})
    if not out:
        out.append({"id": "main", "name": _s(m.get("title"), 60).strip() or "Meeting", "date": _s(m.get("date"), 40),
                    "notes": _s(m.get("notes"), 2000)})
    return out


def meeting_of(frame, meetings):
    g = str((frame or {}).get("group") or "").strip().lower()
    for m in meetings:
        if m["name"].lower() == g:
            return m
    return meetings[0]


IDENTITY = ("id", "created", "modified", "group")


def _content(value, top=True):
    if isinstance(value, dict):
        return {k: _content(v, False) for k, v in value.items() if k not in (IDENTITY if top else ("id",))}
    if isinstance(value, list):
        return [_content(v, False) for v in value]
    return value


def frame_print(body):
    """A Frame's content: its ids (and its Content's), times and the meeting it is filed under aside, so the same Frame
    made on two PCs compares equal."""
    return canon(_content(body))


def _norm(text):
    return re.sub(r"\s+", " ", str(text or "")).strip().lower()


def _phone(text):
    digits = re.sub(r"\D", "", str(text or ""))
    return digits[-9:] if len(digits) >= 7 else ""


def list_key(kind, body):
    """What makes two list items the same: a member's email or phone, a verse's reference and version, a question's
    words. None when there is nothing to tell them by."""
    if not isinstance(body, dict):
        return None
    if kind == "member":
        keys = []
        if "@" in str(body.get("email") or ""):
            keys.append("e:" + _norm(body["email"]))
        if _phone(body.get("phone")):
            keys.append("p:" + _phone(body.get("phone")))
        return keys or None
    if kind == "library_verse":
        ref = _norm(body.get("ref")).replace("–", "-").replace("—", "-")
        return ["v:" + ref + "|" + _norm(body.get("version"))] if ref else None
    if kind == "library_question":
        words = re.sub(r"[^\w\s]", "", _norm(body.get("text")))
        return ["q:" + words] if words else None
    return None


MEMBER_FILL = ("email", "phone", "birthDate", "country", "role")


def _same_meeting(a, b, single=False):
    if single:                                   # one meeting on each side, no list on either: the same plan
        return True
    if a["id"] == b["id"] and a["id"] != "main" and a["name"].lower() == b["name"].lower():
        return True
    if a["name"].lower() != b["name"].lower():
        return False
    return not a["date"] or not b["date"] or a["date"] == b["date"]


def _unique(name, taken):
    base = (name[:60 - len(SUFFIX)] + SUFFIX) if not name.endswith(SUFFIX) else name
    out, n = base[:60], 2
    while out.lower() in taken:
        out = f"{base[:56]} {n}"
        n += 1
    taken.add(out.lower())
    return out


def plan(local, remote, mode="keep"):
    """local, remote: {"kind/id": {"kind", "id", "body", ...}} (remote: the newest of each, deleted ones included).
    Returns None when the workspace holds no meetings yet (nothing to decide: this PC's plan simply goes up), else
    {"rows": [...], "counts": {...}, "meetings": the merged list, "regroup": {local key: group}, "newIds": {local key},
     "dropLocal": [local keys], "deleteRemote": [remote keys], "preferLocal": [remote keys]}."""
    mode = mode if mode in MODES else "keep"
    live = {k: r for k, r in remote.items() if not r.get("deleted") and r.get("body") is not None}
    r_frames = {k: r for k, r in live.items() if r["kind"] == "frame"}
    if not r_frames:
        return None
    l_meeting = (local.get("meeting/meeting") or {}).get("body") or {}
    r_meeting = (live.get("meeting/meeting") or {}).get("body") or {}
    lm, rm = meetings_of(l_meeting), meetings_of(r_meeting)
    l_frames = {k: r for k, r in local.items() if r["kind"] == "frame"}

    def by_meeting(frames, meetings):
        out = {m["id"]: [] for m in meetings}
        for k, r in frames.items():
            out[meeting_of(r["body"], meetings)["id"]].append(k)
        return out

    lf, rf = by_meeting(l_frames, lm), by_meeting(r_frames, rm)
    merged = [dict(m) for m in rm]
    taken = {m["name"].lower() for m in merged}
    r_ids = {r["id"] for r in r_frames.values()}
    rows, regroup, new_ids, drop_local, delete_remote, prefer_local = [], {}, set(), [], [], []
    counts = {"same": 0, "added": 0, "here": 0, "there": 0, "changed": 0, "framesSkipped": 0, "framesAdded": 0}
    matched = set()
    single = not isinstance(l_meeting.get("meetings"), list) and not isinstance(r_meeting.get("meetings"), list)
    for m in lm:
        keys = lf.get(m["id"], [])
        other = next((x for x in rm if x["id"] not in matched and _same_meeting(m, x, single)), None)
        if other is None:
            if not keys and len(lm) > 1:
                continue                                 # an empty meeting entry: nothing to bring
            name = m["name"] if m["name"].lower() not in taken else _unique(m["name"], taken)
            taken.add(name.lower())
            merged.append({"id": m["id"] if all(x["id"] != m["id"] for x in merged) else m["id"] + "-pc",
                           "name": name, "date": m["date"], "notes": m["notes"]})
            for k in keys:
                regroup[k] = name
                if l_frames[k]["id"] in r_ids:
                    new_ids.add(k)
            counts["here"] += 1
            counts["framesAdded"] += len(keys)
            rows.append({"name": name, "status": "here", "frames": len(keys)})
            continue
        matched.add(other["id"])
        theirs_keys = rf.get(other["id"], [])
        pool = {}
        for k in theirs_keys:
            pool.setdefault(frame_print(r_frames[k]["body"]), []).append(k)
        identical, rest, used = [], [], set()
        for k in keys:                                   # the fingerprint check: what the workspace has is skipped
            hits = pool.get(frame_print(l_frames[k]["body"])) or []
            if hits:
                used.add(hits.pop())
                identical.append(k)
            else:
                rest.append(k)
        free = [k for k in theirs_keys if k not in used]
        edited = [k for k in rest if l_frames[k]["id"] in {r_frames[x]["id"] for x in free}
                  or _norm(l_frames[k]["body"].get("name")) in {_norm(r_frames[x]["body"].get("name")) for x in free}]
        counts["framesSkipped"] += len(identical)
        if not rest:
            counts["same"] += 1
            rows.append({"name": other["name"], "status": "same", "frames": len(keys)})
            drop_local.extend(keys)                      # already there: skipped, the workspace's own arrive
            continue
        if not edited:                                   # this PC only adds Frames: they join the same meeting
            counts["added"] = counts.get("added", 0) + 1
            counts["framesAdded"] += len(rest)
            rows.append({"name": other["name"], "status": "added", "frames": len(keys), "new": len(rest)})
            drop_local.extend(identical)
            for k in rest:
                if single:
                    continue
                regroup[k] = other["name"]
            continue
        counts["changed"] += 1
        row = {"name": other["name"], "status": "changed", "frames": len(keys), "theirs": len(theirs_keys)}
        if mode == "workspace":
            drop_local.extend(keys)
            row["outcome"] = "workspace"
        elif mode == "pc":
            local_ids = {l_frames[k]["id"] for k in keys}
            for k in theirs_keys:
                (prefer_local if r_frames[k]["id"] in local_ids else delete_remote).append(k)
            for k in keys:
                regroup[k] = other["name"]
            row["outcome"] = "pc"
        else:
            name = _unique(other["name"], taken)
            merged.append({"id": m["id"] + "-pc" if any(x["id"] == m["id"] for x in merged) else m["id"],
                           "name": name, "date": m["date"], "notes": m["notes"]})
            for k in keys:
                regroup[k] = name
                if l_frames[k]["id"] in r_ids:
                    new_ids.add(k)
            counts["framesAdded"] += len(keys)
            row["outcome"] = "keep"
            row["copy"] = name
        rows.append(row)
    for x in rm:
        if x["id"] not in matched:
            counts["there"] += 1
            rows.append({"name": x["name"], "status": "there", "frames": len(rf.get(x["id"], []))})

    lists = list_duplicates(local, live)
    counts["listsSkipped"] = len(lists["drop"])
    return {"rows": rows, "counts": counts, "meetings": merged, "regroup": regroup, "newIds": sorted(new_ids),
            "dropLocal": drop_local, "deleteRemote": delete_remote, "preferLocal": prefer_local, "lists": lists,
            "mode": mode}


def list_duplicates(local, live):
    """Local list items (another id) that are already in the workspace: {"drop": [local keys], "fill": {remote key:
    body with a member's missing details filled in}}."""
    drop, fill = [], {}
    for kind in ("member", "library_verse", "library_question"):
        index = {}
        for k, r in live.items():
            if r["kind"] == kind:
                for key in list_key(kind, r["body"]) or []:
                    index.setdefault(key, k)
        for k, r in local.items():
            if r["kind"] != kind or k in live:
                continue
            hit = next((index[key] for key in list_key(kind, r["body"]) or [] if key in index), None)
            if not hit:
                continue
            drop.append(k)
            if kind == "member":
                body = copy.deepcopy(fill.get(hit) or live[hit]["body"])
                changed = False
                for f in MEMBER_FILL:
                    if not body.get(f) and r["body"].get(f):
                        body[f] = r["body"][f]
                        changed = True
                if changed:
                    fill[hit] = body
    return {"drop": drop, "fill": fill}


def preview(p):
    """The plan in the words of the dialog (no keys)."""
    if p is None:
        return {"empty": True, "rows": [], "counts": {}}
    return {"empty": False, "rows": p["rows"], "counts": p["counts"]}
