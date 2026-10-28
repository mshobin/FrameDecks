"""FrameDecks - optional AI, free by default (M-D3: docs/project/history/migration-plan.md). Discussion questions drafted from a
Frame's scripture by Ollama on this PC, cached, and hidden when no AI answers. A stand-in Ollama server answers here."""
import json
import os
import sys
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT))
os.environ.setdefault("KC_DATA_DIR", tempfile.mkdtemp(prefix="kc-test-"))
os.environ["FRAMEDECKS_SECRET_STORE"] = "file"
import ai  # noqa: E402


class FakeOllama(BaseHTTPRequestHandler):
    models = ["phi3:mini", "llama3.2:latest"]
    answer = json.dumps({"questions": ["1. What does verse 16 say about God's love?", "What does it mean to believe in him?",
                                       "What does verse 16 say about God's love?", "ok?", "How could you share this hope this week?"]})
    generated = []

    def log_message(self, *a):
        pass

    def _json(self, body, code=200):
        data = json.dumps(body).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path == "/api/tags":
            return self._json({"models": [{"name": n} for n in FakeOllama.models]})
        self._json({}, 404)

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        FakeOllama.generated.append(body)
        self._json({"response": FakeOllama.answer})


class AiTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.srv = ThreadingHTTPServer(("127.0.0.1", 0), FakeOllama)
        threading.Thread(target=cls.srv.serve_forever, daemon=True).start()
        cls.url = f"http://127.0.0.1:{cls.srv.server_address[1]}"

    @classmethod
    def tearDownClass(cls):
        cls.srv.shutdown()

    def setUp(self):
        FakeOllama.generated.clear()
        FakeOllama.models = ["phi3:mini", "llama3.2:latest"]
        self.cache = Path(tempfile.mkdtemp(prefix="kc-ai-")) / "kc-ai-cache.json"
        self.on = True
        self.svc = ai.Service(self.cache, enabled=lambda: self.on, make_provider=lambda: ai.Ollama(self.url))

    def test_a_preferred_model_is_chosen_and_questions_are_cleaned(self):
        st = self.svc.status()
        self.assertEqual((st["ok"], st["model"]), (True, "llama3.2:latest"), "llama3.2 is preferred over phi3")
        res = self.svc.discussion_questions([{"ref": "John 3:16", "text": "For God so loved the world…"}], 5)
        self.assertEqual(res["questions"], ["What does verse 16 say about God's love?", "What does it mean to believe in him?",
                                            "How could you share this hope this week?"])
        self.assertFalse(res["cached"])
        sent = FakeOllama.generated[0]
        self.assertEqual((sent["model"], sent["stream"], sent["format"]), ("llama3.2:latest", False, "json"))
        self.assertIn("John 3:16", sent["prompt"])
        self.assertIn("For God so loved the world", sent["prompt"])

    def test_the_same_request_comes_from_the_cache_even_offline(self):
        p = [{"ref": "Psalm 23:1", "text": "The Lord is my shepherd"}]
        self.svc.discussion_questions(p, 3)
        FakeOllama.answer, keep = "{}", FakeOllama.answer
        try:
            res = self.svc.discussion_questions(p, 3)
        finally:
            FakeOllama.answer = keep
        self.assertTrue(res["cached"])
        self.assertEqual(len(FakeOllama.generated), 1, "asked once")
        self.assertTrue(self.cache.exists())

    def test_hidden_and_plain_messages_when_no_ai_answers(self):
        none = ai.Service(self.cache, make_provider=lambda: ai.Ollama("http://127.0.0.1:9"))
        self.assertEqual(none.status()["reason"], "Ollama is not running on this PC")
        with self.assertRaises(ai.AiError):
            none.discussion_questions([{"ref": "John 1:1", "text": "In the beginning"}])
        FakeOllama.models = []
        self.assertIn("ollama pull", self.svc.status(fresh=True)["reason"])
        self.on = False
        self.assertEqual(self.svc.status(fresh=True)["reason"], "AI is turned off")
        with self.assertRaises(ai.AiError) as e:
            self.svc.discussion_questions([])
        self.assertIn("Scripture first", str(e.exception))

    def test_answers_in_other_shapes(self):
        self.assertEqual(ai.parse_questions('Sure! ["What happened first?", "Why did he go?"]', 5), ["What happened first?", "Why did he go?"])
        self.assertEqual(ai.parse_questions("- Who was there?\n2) What did Jesus say?\n\n", 5), ["Who was there?", "What did Jesus say?"])
        self.assertEqual(ai.parse_questions('{"questions": ["' + "x" * 400 + '"]}', 5)[0], "x" * 300)
        self.assertEqual(ai.parse_questions("not json at all", 5), ["not json at all"])

    def test_a_self_hosted_endpoint_is_used_when_set(self):
        os.environ["FRAMEDECKS_AI_ENDPOINT"] = "https://ai.church.example"
        os.environ["FRAMEDECKS_AI_MODEL"] = "llama3.1"
        try:
            p = ai.provider()
        finally:
            del os.environ["FRAMEDECKS_AI_ENDPOINT"], os.environ["FRAMEDECKS_AI_MODEL"]
        self.assertIsInstance(p, ai.Endpoint)
        self.assertEqual(p.available()["model"], "llama3.1")
        self.assertIsInstance(ai.provider(), ai.Ollama)


class ServerAiTest(unittest.TestCase):
    def test_the_server_fills_in_scripture_text_and_has_the_setting(self):
        import server
        self.assertEqual(server.app_settings()["ai"], "auto")
        self.assertTrue(server._valid_setting("ai", "off"))
        real = server.scripture_lookup
        server.scripture_lookup = lambda ref, *a, **k: {"text": "Text of " + ref}
        try:
            got = server._passages_with_text([{"ref": "John 3:16", "text": ""}, {"ref": "Ps 23", "text": "Typed"}, "bad"])
        finally:
            server.scripture_lookup = real
        self.assertEqual(got, [{"ref": "John 3:16", "text": "Text of John 3:16"}, {"ref": "Ps 23", "text": "Typed"}])


if __name__ == "__main__":
    unittest.main()
