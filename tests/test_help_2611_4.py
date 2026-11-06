"""FrameDecks 26.11.4 - Help: error codes, the connection check, Help links, What's new and Keys, the support report."""
import json
import re
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))


def read(rel):
    return (ROOT / rel).read_text(encoding="utf-8")


def codes():
    js = read("app/js/help-codes.js")
    return json.loads(js[js.index("/* codes:start */") + 17:js.index("/* codes:end */")])


class ErrorCodes(unittest.TestCase):
    def test_every_code_says_what_why_and_the_fix(self):
        seen = set()
        for c in codes():
            self.assertRegex(c["code"], r"^FD-(REM|NET|CLD)-\d\d$")
            self.assertNotIn(c["code"], seen)
            seen.add(c["code"])
            for k in ("area", "title", "why", "fix"):
                self.assertTrue(c[k].strip(), c["code"] + " " + k)

    def test_every_code_is_used_somewhere_it_can_happen(self):
        used = "".join(read(f) for f in ("app/js/remote-panel.js", "app/js/remote.js", "app/js/meeting.js",
                                          "hosted/src/components/computers-panel.tsx",
                                          "hosted/src/components/connect-panel.tsx"))
        for c in codes():
            self.assertIn(c["code"], used, c["code"] + " is never shown")

    def test_the_website_has_the_same_list(self):
        self.assertEqual(json.loads(read("hosted/content/help-codes.json")), codes())


class ConnectionCheck(unittest.TestCase):
    def test_the_check_goes_step_by_step_and_offers_one_fix(self):
        js = read("app/js/remote-panel.js")
        self.assertIn("Check my connection", js)
        steps = js[js.index("function cxSteps("):js.index("function cxDraw(")]
        order = ["FD-REM-01", "FD-NET-01", "FD-NET-04", "FD-NET-02", "FD-NET-03", "FD-NET-06", "FD-REM-04", "FD-NET-05"]
        self.assertEqual([steps.index(c) for c in order], sorted(steps.index(c) for c in order))
        self.assertIn("return steps;", steps)                          # the first problem stops the list
        self.assertIn("firewall('allow')", steps)                      # the fix that asks Windows first
        self.assertIn("openSettings('network-status')", steps)
        self.assertIn('<script src="js/help-codes.js"></script>', read("app/dashboard.html"))

    def test_only_two_windows_settings_pages_can_be_opened(self):
        import server
        self.assertEqual(server.SETTINGS_PAGES, ("ms-settings:network-wifi", "ms-settings:network-status"))
        self.assertFalse(server.open_external("ms-settings:windowsupdate"))
        self.assertFalse(server.open_external("file:///C:/Windows"))
        src = read("src/server.py")
        body = src[src.index("def open_external("):src.index("FIREWALL_RULE =")]
        self.assertNotIn("subprocess", body)                           # no command line, nothing hidden (7.1.1)

    def test_the_phone_can_test_its_connection(self):
        self.assertIn('id="cx-test"', read("app/remote.html"))
        js = read("app/js/remote.js")
        self.assertIn("fetch('api/rev'", js[js.index("$('cx-test')"):])
        self.assertIn("(FD-REM-02)", js)

    def test_linking_a_pc_waits_for_the_pc_to_confirm(self):
        tsx = read("hosted/src/components/computers-panel.tsx")
        self.assertIn("Waiting for the PC to confirm", tsx)
        self.assertIn("last_seen_at", tsx[tsx.index("Waiting for the PC to confirm"):])


if __name__ == "__main__":
    unittest.main()


def slugify(text):
    """hosted/src/lib/markdown.ts slugify, so a link's #anchor is the heading's id on the website"""
    import re as _re
    t = _re.sub(r"<[^>]+>", "", text.lower())
    t = _re.sub(r"[^\w\s-]", "", t).replace("_", "")
    return _re.sub(r"\s", "-", t.strip())


class HelpLinks(unittest.TestCase):
    def links(self):
        import re as _re
        js = read("app/js/help-codes.js")
        return dict(_re.findall(r"'([a-z-]+)': \['[^']+', '([^']+)'\]", js))

    def test_every_help_link_opens_a_real_page_and_heading(self):
        links = self.links()
        self.assertGreaterEqual(len(links), 6)
        for area, url in links.items():
            page, _, anchor = url.partition("#")
            if page == "help":
                self.assertIn('id: "%s"' % anchor, read("hosted/src/components/help-center.tsx"), area)
                continue
            self.assertTrue(page.startswith("docs/"), area)
            md = read("docs/guide/%s.md" % page[5:])
            heads = [slugify(line[3:]) for line in md.splitlines() if line.startswith("## ")]
            self.assertIn(anchor, heads, area + " → " + url)

    def test_the_question_marks_sit_where_people_get_stuck(self):
        dash = read("app/dashboard.html")
        self.assertIn('data-help="memory"', dash)
        self.assertIn('data-help="sync"', dash)
        self.assertIn("KCHelpCodes.button('remote')", read("app/js/remote-panel.js"))
        self.assertIn("KCHelpCodes.button('vcam')", read("app/js/vcam-panel.js"))
        sp = read("app/speaker.html")
        self.assertIn('data-help="voice"', sp)
        self.assertLess(sp.index("<script src=\"js/help-codes.js\">"), sp.index("<script src=\"js/speaker.js\">"))
        self.assertLess(dash.index("<script src=\"js/help-codes.js\">"), dash.index("<script src=\"js/remote-panel.js\">"))


class HelpSearch(unittest.TestCase):
    def test_the_help_center_searches_and_opens_error_codes(self):
        tsx = read("hosted/src/components/help-center.tsx")
        self.assertIn('id: "codes"', tsx)
        self.assertIn('get("code")', tsx)
        self.assertIn("<HelpSearch", tsx)
        self.assertIn("helpIndex()", read("hosted/src/app/help/page.tsx"))


class KeysAndWhatsNew(unittest.TestCase):
    def keys(self):
        import re as _re
        return _re.findall(r"\{keys: '([^']+)', what: '([^']+)', where: '([^']+)'\}", read("app/js/keys.js"))

    def test_every_listed_key_is_answered_by_the_code(self):
        rows = self.keys()
        self.assertEqual(len(rows), len(json.loads(read("hosted/content/help-keys.json"))))
        remote = read("app/js/spotlight-remote.js")
        cc = read("app/js/command-center.js")
        for keys, what, where in rows:
            if where != "Command Center" or not keys.startswith("Alt+"):
                continue
            if "…" in keys:                                      # Alt+1 … Alt+5: the chips
                self.assertIn("/^[1-5]$/.test(e.key)", cc)
                continue
            for part in keys.replace(" / ", "|").split("|"):
                k = part.split("+", 1)[1].strip()
                k = {"→": "ArrowRight", "←": "ArrowLeft", "↓": "ArrowDown", "↑": "ArrowUp"}.get(k, k.lower())
                self.assertIn("'Alt+%s'" % k, remote, keys)
        self.assertIn("e.key !== '?'", cc)                       # ? opens the sheet when the search is empty
        self.assertIn('<script src="js/keys.js"></script>', read("app/spotlight.html"))
        self.assertIn('id="keys-global"', read("app/dashboard.html"))

    def test_whats_new_has_three_items_for_this_release_and_waits_for_returning_people(self):
        js = read("app/js/whats-new.js")
        self.assertIn("'26.11.4': [", js)
        block = js[js.index("'26.11.4': ["):js.index("]\n};")]
        self.assertEqual(block.count("{title:"), 3)
        self.assertIn("if (!(ob.done || ob.skipped)){ seen(v); return; }", js)   # not on a first install
        self.assertIn("if (live) return;", js)                                     # never over a live meeting
        for spot in re.findall(r"spot: '#([\w-]+)'", block):
            self.assertTrue(f'id="{spot}"' in read("app/dashboard.html") or f"id: '{spot}'" in read("app/js/remote-panel.js"), spot)


class ClipsAndVotes(unittest.TestCase):
    def test_every_clip_shown_has_its_moving_picture_and_its_still(self):
        tsx = read("hosted/src/components/help-center.tsx")
        names = re.findall(r'name: "([a-z-]+)", title:', tsx)
        self.assertGreaterEqual(len(names), 5)
        for n in names:
            for f in (n + ".webp", n + "-still.webp"):
                p = ROOT / "hosted/public/help/clips" / f
                self.assertTrue(p.exists(), f)
                self.assertLess(p.stat().st_size, 400_000, f)      # small enough for a phone
        clip = read("hosted/src/components/help-clip.tsx")
        self.assertIn('media="(prefers-reduced-motion: reduce)"', clip)    # less motion: the still
        self.assertIn("html.fd-calm .hc-clip .hc-clip-still{display:block}", read("hosted/src/app/help/guide.css"))
        self.assertIn('loading="lazy"', clip)

    def test_votes_keep_only_the_article_and_the_answer(self):
        vote = read("hosted/src/components/help-vote.tsx")
        self.assertIn('rpc("help_vote", { article, helpful })', vote)
        self.assertIn("<HelpVote", read("hosted/src/components/help-center.tsx"))
        self.assertIn("<HelpVote", read("hosted/src/app/docs/[slug]/page.tsx"))
        sql = read("hosted/supabase/migrations/0017_help_votes.sql")
        self.assertIn("revoke all on table public.help_votes from public, anon, authenticated;", sql)
        self.assertTrue((ROOT / "hosted/supabase/rollback/0017_help_votes_down.sql").exists())


class SupportAndHelpBot(unittest.TestCase):
    def test_the_support_report_is_shown_in_full_before_anything_is_sent(self):
        js = read("app/js/settings.js")
        body = js[js.index("function supportReport("):js.index("window.KCSupport =")]
        self.assertIn("Your reference: ", body)
        self.assertIn("Nothing is sent until you choose below.", body)
        self.assertIn("'mailto:' + SUPPORT", body)                     # only when Email support is chosen
        lines = js[js.index("function reportLines("):js.index("function copyReport(")]
        for never in ("d.pin", "folder", "dataFolder", "members"):
            self.assertNotIn(never, lines)                               # no PIN, paths or member data
        self.assertIn("Connection check: ", lines)
        self.assertIn("KCSupport.open()", read("app/js/remote-panel.js"))

    def test_ask_help_answers_from_help_and_sends_nothing(self):
        bot = read("hosted/src/components/help-bot.tsx")
        self.assertIn("searchHelp(index, q, 3)", bot)
        self.assertNotIn("fetch(", bot)
        self.assertNotIn("supabase", bot)
        for code_step in ("FD-NET-05",):
            self.assertIn(code_step, bot)
        self.assertIn('id: "ask"', read("hosted/src/components/help-center.tsx"))
        self.assertIn('href="https://framedecks.com/help#ask"', read("app/remote.html"))


class Release(unittest.TestCase):
    def test_whats_new_speaks_about_this_version(self):
        import server
        self.assertIn("'%s': [" % server.APP_VERSION, read("app/js/whats-new.js"))
