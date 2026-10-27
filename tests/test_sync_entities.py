"""FrameDecks - sync records (src/sync_entities.py): a saved plan and member list split into records and join back
exactly; nothing live, no media and no card text of the moment is ever in a record; a push carries only what
changed. The companion checks the same fixtures (hosted/tests/sync-entities.test.mjs)."""
import copy
import json
import re
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT))
import sync_entities as E  # noqa: E402

FIXTURES = sorted((ROOT / "tests" / "fixtures" / "sync").glob("*.json"))


def load(name):
    return json.loads((ROOT / "tests" / "fixtures" / "sync" / f"{name}.json").read_text(encoding="utf-8"))


def keys(records):
    return [f"{r['kind']}/{r['id']}" for r in records]


class Fixtures(unittest.TestCase):
    def test_split_matches_the_recorded_records_and_joins_back_exactly(self):
        self.assertGreaterEqual(len(FIXTURES), 3)
        for path in FIXTURES:
            fx = json.loads(path.read_text(encoding="utf-8"))
            with self.subTest(path.name):
                parts = E.split(fx["normalized"], fx["members"])
                self.assertEqual(E.canon(parts), E.canon(fx["split"]))
                doc, members = E.join(parts["entities"], parts["local"])
                self.assertEqual(E.canon(doc), E.canon(fx["normalized"]), "the same document")
                self.assertEqual(list(doc), list(fx["normalized"]), "its sections in the same order")
                self.assertEqual(members, fx["members"])
                shuffled = list(reversed(parts["entities"]))
                self.assertEqual(E.join(shuffled, parts["local"]), (doc, members), "record order does not matter")
                self.assertEqual(len(set(keys(parts["entities"]))), len(parts["entities"]), "one record per kind and id")
                for r in parts["entities"]:
                    self.assertIn(r["kind"], E.KINDS)

    def test_kinds_match_the_database(self):
        sql = (ROOT / "hosted" / "supabase" / "migrations" / "0003_sync.sql").read_text(encoding="utf-8")
        listed = re.search(r"kind text not null check \(kind in \((.*?)\)\)", sql, re.S).group(1)
        self.assertEqual(sorted(re.findall(r"'([a-z_]+)'", listed)), sorted(E.KINDS))

    def test_nothing_live_and_no_text_of_the_moment_leaves_the_pc(self):
        fx = load("service")
        sent = json.dumps(E.split(fx["normalized"], fx["members"])["entities"], ensure_ascii=False)
        for word in ("What does this passage reveal about God?", "Happy birthday, Ruth!", '"live"', '"rev"'):
            self.assertNotIn(word, sent)
        local = E.split(fx["normalized"], fx["members"])["local"]
        self.assertEqual(local["live"], fx["normalized"]["live"])
        self.assertEqual(local["rev"], 57)

    def test_media_travels_as_a_file_name_only(self):
        fx = load("service")
        sent = json.dumps(E.split(fx["normalized"], fx["members"])["entities"], ensure_ascii=False)
        self.assertIn('"file": "Opening video.mp4"', sent)
        self.assertIn('"file": "Welcome slide.png"', sent)
        self.assertNotIn("data:", sent)
        self.assertNotIn("base64", sent)

    def test_scripts_and_members_sync(self):
        fx = load("service")
        records = E.split(fx["normalized"], fx["members"])["entities"]
        study = next(r for r in records if r["kind"] == "frame" and r["body"]["name"] == "Study: John 3")
        self.assertEqual(study["body"]["notes"], "Read verse 16 slowly.\nPause for questions.")
        self.assertEqual([r["body"]["name"] for r in records if r["kind"] == "member"], ["Ruth Adams", "Paul Brown"])


class Changes(unittest.TestCase):
    def setUp(self):
        fx = load("service")
        self.doc, self.members = fx["normalized"], fx["members"]
        self.base = E.split(self.doc, self.members)["entities"]

    def after(self, change, members=None):
        doc = copy.deepcopy(self.doc)
        change(doc)
        return E.split(doc, self.members if members is None else members)["entities"]

    def test_going_live_and_showing_cards_sends_nothing(self):
        def live(d):
            d["live"]["scene"] = d["scenes"][0]["id"]
            d["live"]["seq"] += 1
            d["question"]["text"], d["question"]["visible"] = "Another question", True
            d["verse"]["visible"] = False
            d["rev"] += 1
        c = E.changes(self.base, self.after(live))
        self.assertEqual((c["upserts"], c["deletes"]), ([], []))

    def test_editing_one_frame_sends_that_frame_only(self):
        def edit(d):
            d["scenes"][1]["notes"] = "New script"
        c = E.changes(self.base, self.after(edit))
        self.assertEqual(keys(c["upserts"]), [f"frame/{self.doc['scenes'][1]['id']}"])
        self.assertEqual(c["deletes"], [])

    def test_a_new_frame_sends_it_and_the_order_never_the_frames_after_it(self):
        def insert(d):
            new = copy.deepcopy(d["scenes"][0])
            new["id"], new["name"] = "sc_new", "Inserted"
            d["scenes"].insert(1, new)
        c = E.changes(self.base, self.after(insert))
        self.assertEqual(sorted(keys(c["upserts"])), ["frame/sc_new", "order/order"])

    def test_a_deleted_frame_is_a_delete_and_the_order(self):
        gone = self.doc["scenes"][2]["id"]
        c = E.changes(self.base, self.after(lambda d: d["scenes"].pop(2)))
        self.assertEqual(c["deletes"], [{"kind": "frame", "id": gone}])
        self.assertEqual(keys(c["upserts"]), ["order/order"])

    def test_a_card_look_is_the_theme(self):
        def look(d):
            d["question"]["transition"] = "words"
        self.assertEqual(keys(E.changes(self.base, self.after(look))["upserts"]), ["theme/cards"])

    def test_editing_a_person_sends_that_person(self):
        people = copy.deepcopy(self.members)
        people[1]["phone"] = "+91 90000 00000"
        c = E.changes(self.base, self.after(lambda d: None, people))
        self.assertEqual(keys(c["upserts"]), ["member/m2"])


class Join(unittest.TestCase):
    def test_a_frame_from_another_pc_that_the_order_lacks_is_kept_at_the_end(self):
        fx = load("service")
        parts = E.split(fx["normalized"], fx["members"])
        extra = copy.deepcopy(next(r for r in parts["entities"] if r["kind"] == "frame"))
        extra["id"] = extra["body"]["id"] = "sc_far"
        doc, _ = E.join(parts["entities"] + [extra], parts["local"])
        self.assertEqual(doc["scenes"][-1]["id"], "sc_far")
        self.assertEqual(len(doc["scenes"]), len(fx["normalized"]["scenes"]) + 1)

    def test_deleted_records_are_left_out(self):
        fx = load("service")
        parts = E.split(fx["normalized"], fx["members"])
        gone = [dict(r, deleted=True, body=None) if r["kind"] == "member" and r["id"] == "m1" else r
                for r in parts["entities"]]
        _, members = E.join(gone, parts["local"])
        self.assertEqual([m["id"] for m in members], ["m2"])

    def test_join_of_nothing_is_an_empty_plan(self):
        doc, members = E.join([], {})
        self.assertEqual(doc["scenes"], [])
        self.assertEqual(members, [])


if __name__ == "__main__":
    unittest.main()
