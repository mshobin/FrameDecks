"""FrameDecks - the service as a PowerPoint file (M-D4: docs/project/history/migration-plan.md). One slide per Frame in plan order,
scripture, questions and words as editable text, pictures from the media folder, the script as speaker notes."""
import copy
import io
import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT))
import pptx_export  # noqa: E402

try:
    import pptx  # noqa: F401
    HAVE_PPTX = True
except ImportError:                                   # the installer always has it (requirements-desktop.txt)
    HAVE_PPTX = False

PLAN = json.loads((ROOT / "tests" / "fixtures" / "sync" / "service.json").read_text(encoding="utf-8"))["normalized"]


def plan_with_words():
    p = copy.deepcopy(PLAN)
    study = next(s for s in p["scenes"] if s["name"] == "Study: John 3")
    for layer in study["layers"]:
        if layer["kind"] == "scripture":
            layer["c"]["items"] = [{"id": "v1", "ref": "John 3:16", "version": "ESV", "text": "For God so loved the world…"}]
        if layer["kind"] == "question":
            layer["c"]["items"] = [{"id": "q1", "text": "What does this show about God?"}, {"id": "q2", "text": " "}]
    welcome = next(s for s in p["scenes"] if s["name"] == "Welcome")
    welcome["layers"][0]["c"]["text"] = "Coffee after the study"
    return p


class PartsTest(unittest.TestCase):
    def test_what_each_frame_says(self):
        p = plan_with_words()
        parts = {s["name"]: pptx_export.frame_parts(s) for s in p["scenes"]}
        self.assertEqual(parts["Study: John 3"], [("verse", "John 3:16 ESV", "For God so loved the world…"),
                                                  ("question", "What does this show about God?")])
        self.assertEqual(parts["Welcome"], [("text", "Announcement", "Coffee after the study")])
        self.assertEqual(parts["Video"], [("media", "video", "Opening video.mp4")])
        self.assertEqual(parts["Slide"], [("picture", "Welcome slide.png")])
        self.assertEqual(pptx_export.frame_parts({"layers": [None, {"kind": "image", "c": None}]}), [])
        self.assertEqual(pptx_export.frame_parts({"layers": [{"kind": "audio", "c": {"file": "Song.mp3"}}]}), [("media", "audio", "Song.mp3")])

    def test_file_name(self):
        self.assertRegex(pptx_export.file_name(PLAN), r"^BSF Study - \d{4}-\d{2}-\d{2}\.pptx$")


@unittest.skipUnless(HAVE_PPTX, "python-pptx is installed with the desktop build")
class BuildTest(unittest.TestCase):
    def test_one_slide_per_frame_with_notes_and_pictures(self):
        from pptx import Presentation
        from PIL import Image
        media = Path(tempfile.mkdtemp(prefix="kc-media-"))
        Image.new("RGB", (64, 36), (200, 160, 80)).save(media / "Welcome slide.png")
        body, frames = pptx_export.build(plan_with_words(), media)
        deck = Presentation(io.BytesIO(body))
        texts = lambda s: " | ".join(sh.text_frame.text for sh in s.shapes if sh.has_text_frame)
        slides = list(deck.slides)
        self.assertEqual(frames, 4, "templates are left out")
        self.assertEqual(len(slides), 5, "a title slide and one per Frame")
        self.assertIn("BSF Study", texts(slides[0]))
        self.assertEqual([texts(s).split(" | ")[0] for s in slides[1:]], ["Welcome", "Study: John 3", "Video", "Slide"])
        study = slides[2]
        self.assertIn("John 3:16 ESV", texts(study))
        self.assertIn("• What does this show about God?", texts(study))
        self.assertEqual(study.notes_slide.notes_text_frame.text, "Read verse 16 slowly.\nPause for questions.")
        self.assertIn("Video: Opening video.mp4 (on the service PC)", texts(slides[3]))
        self.assertEqual(sum(1 for sh in slides[4].shapes if sh.shape_type == 13), 1, "the picture is in the slide")
        self.assertFalse(slides[1].has_notes_slide and slides[1].notes_slide.notes_text_frame.text)

    def test_a_missing_picture_is_named_not_fatal(self):
        body, _ = pptx_export.build(plan_with_words(), Path(tempfile.mkdtemp()))
        self.assertGreater(len(body), 10000)


if __name__ == "__main__":
    unittest.main()
