"""FrameDecks - a saved plan as sync records ("entities"), and back.

Design: docs/architecture/metadata-sync.md (section 3). Ported from the tested Phase 2 mapping (app/js/entities.js on
tag archive/saas-phase2), with the member list added as one record per person (owner decision D2).

    split(doc, members)        -> {"entities": [{"kind", "id", "body"}], "local": {...}}
    join(entities, local)      -> (doc, members)   the same document and member list again
    changes(before, after)     -> {"upserts": [entity], "deletes": [{"kind", "id"}]}   what a push sends

doc is the saved state (kc-saved-content.json, as KCStore.normalize writes it); members is the "members" list of
kc-members-private.json. Only records go to the cloud. `local` stays on this PC: what is live, the revision, the
cards' text of the moment, and anything this version does not know. No media is ever in a record: media layers
keep only their file name. The companion has the same mapping in hosted/src/lib/sync-entities.ts; both are checked
against tests/fixtures/sync/.
"""
import copy
import json

KINDS = ("frame", "template", "order", "library_question", "library_verse", "theme", "brand", "layout", "meeting",
         "member")

# What a card shows right now (live, never synced); every other card field is its look (the theme record).
CARD_LIVE = {
    "question": ["text", "visible", "seq", "cut", "itemId", "mode", "play", "upcoming", "out"],
    "verse": ["text", "ref", "version", "visible", "seq", "cut", "itemId", "play", "upcoming", "out"],
    "birthday": ["name", "greeting", "message", "country", "visible", "seq", "cut", "out"],
}
CARDS = ("question", "verse", "birthday")
SINGLE = ("brand", "layout", "meeting")  # one record each, the block as it is


def canon(value):
    """JSON with sorted keys and no spaces: equal content gives equal text, whatever the key order."""
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def _ids(items):
    """List items -> record ids, unique within the list (a repeated id gets #2, #3... so nothing is lost)."""
    seen, out = {}, []
    for i, item in enumerate(items):
        raw = item.get("id") if isinstance(item, dict) else None
        key = str(raw) if raw not in (None, "") else "#" + str(i)
        seen[key] = seen.get(key, 0) + 1
        out.append(key if seen[key] == 1 else key + "#" + str(seen[key]))
    return out


def _list(value):
    return value if isinstance(value, list) else []


def split(doc, members=None):
    doc = copy.deepcopy(doc) if isinstance(doc, dict) else {}
    members = copy.deepcopy(_list(members))
    out = []

    def add(kind, rid, body):
        out.append({"kind": kind, "id": str(rid), "body": body})

    scenes = _list(doc.get("scenes"))
    scene_ids = _ids(scenes)
    for scene, rid in zip(scenes, scene_ids):
        add("template" if isinstance(scene, dict) and scene.get("tpl") else "frame", rid, scene)
    library = doc.get("library") if isinstance(doc.get("library"), dict) else {}
    questions, verses = _list(library.get("questions")), _list(library.get("verses"))
    q_ids, v_ids = _ids(questions), _ids(verses)
    for item, rid in zip(questions, q_ids):
        add("library_question", rid, item)
    for item, rid in zip(verses, v_ids):
        add("library_verse", rid, item)
    member_ids = _ids(members)
    for person, rid in zip(members, member_ids):
        add("member", rid, person)
    add("order", "order", {"scenes": scene_ids, "questions": q_ids, "verses": v_ids, "members": member_ids})
    theme = {}
    for card in CARDS:
        if isinstance(doc.get(card), dict):
            theme[card] = {k: v for k, v in doc[card].items() if k not in CARD_LIVE[card]}
    add("theme", "cards", theme)
    for key in SINGLE:
        if key in doc:
            add(key, key, doc[key])
    if "profile" in doc:
        add("layout", "profile", {"value": doc["profile"]})

    # What stays here: everything not sent above.
    local = {}
    for key, value in doc.items():
        if key in ("scenes", "profile") or key in SINGLE:
            continue
        if key == "library":
            local["library"] = {k: v for k, v in library.items() if k not in ("questions", "verses")}
        elif key in CARDS and isinstance(value, dict):
            local[key] = {k: value[k] for k in CARD_LIVE[key] if k in value}
        else:
            local[key] = value
    local["keys"] = list(doc.keys())  # the document's own key order, so join writes it back the same
    return {"entities": out, "local": local}


def join(entities, local):
    local = copy.deepcopy(local) if isinstance(local, dict) else {}
    by = {}
    for e in entities or []:
        if isinstance(e, dict) and e.get("body") is not None and not e.get("deleted"):  # an empty record is none
            by.setdefault(e.get("kind"), {})[str(e.get("id"))] = e

    def body(kind, rid):
        e = by.get(kind, {}).get(rid)
        return copy.deepcopy(e["body"]) if e else None

    order = body("order", "order") or {}

    def ordered(kinds, ids):
        """Records in the order's sequence, then any the order does not list yet (added elsewhere) at the end."""
        got, listed = [], set(ids)
        for rid in ids:
            for kind in kinds:
                b = body(kind, rid)
                if b is not None:
                    got.append(b)
                    break
        for kind in kinds:
            for rid, e in by.get(kind, {}).items():
                if rid not in listed:
                    got.append(copy.deepcopy(e["body"]))
        return got

    keys = local.pop("keys", None) or []
    parts = {"scenes": ordered(("frame", "template"), _list(order.get("scenes")))}
    library = {"verses": ordered(("library_verse",), _list(order.get("verses"))),
               "questions": ordered(("library_question",), _list(order.get("questions")))}
    library.update(local.get("library") or {})
    parts["library"] = library
    theme = body("theme", "cards") or {}
    for card in CARDS:
        if card in local or card in theme:
            merged = dict(theme.get(card) or {})
            merged.update(local.get(card) or {})
            parts[card] = merged
    for key in SINGLE:
        b = body(key, key)
        if b is not None:
            parts[key] = b
    profile = body("layout", "profile")
    if profile is not None:
        parts["profile"] = profile.get("value")
    for key, value in local.items():
        if key not in parts and key != "library" and key not in CARDS:
            parts[key] = value

    doc = {}
    for key in keys:
        if key in parts:
            doc[key] = parts[key]
    for key, value in parts.items():
        if key not in doc:
            doc[key] = value
    members = ordered(("member",), _list(order.get("members")))
    return doc, members


def changes(before, after):
    """What changed between two record lists: the records to send, and the ones that are gone."""
    old = {(e["kind"], e["id"]): canon(e["body"]) for e in before or []}
    now = {(e["kind"], e["id"]) for e in after or []}
    upserts = [e for e in after or [] if old.get((e["kind"], e["id"])) != canon(e["body"])]
    deletes = [{"kind": e["kind"], "id": e["id"]} for e in before or [] if (e["kind"], e["id"]) not in now]
    return {"upserts": upserts, "deletes": deletes}
