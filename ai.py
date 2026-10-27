"""FrameDecks - optional AI, free by default (M-D3 in docs/migration-plan.md; design in docs/architecture-review.md §6).

One small interface, so a feature never calls a vendor directly:
    provider().available() -> {"ok", "provider", "model", "reason"}
    provider().generate(prompt, system) -> text

Providers, in the order they are tried:
  1. Ollama on this PC (http://127.0.0.1:11434): free, private, works offline. The model is the first installed one of
     PREFERRED, else the first installed, or FRAMEDECKS_AI_MODEL.
  2. A self-hosted endpoint that speaks the OpenAI-compatible chat API (a church or community server):
     FRAMEDECKS_AI_ENDPOINT (+ FRAMEDECKS_AI_MODEL; its key, if any, in FRAMEDECKS_AI_KEY).
  Paid providers are never called from the PC: they would go through a server-side function with the key kept there.

Nothing here runs unless a feature asks, and every feature is hidden when no provider answers, so FrameDecks works
exactly as before without AI. Results are cached by (feature, model, input) in kc-ai-cache.json: asking again costs
nothing and works offline.
"""
import hashlib
import json
import os
import re
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path

OLLAMA_URL = os.environ.get("FRAMEDECKS_OLLAMA_URL", "http://127.0.0.1:11434").rstrip("/")
PREFERRED = ("llama3.2", "llama3.1", "llama3", "gemma3", "gemma2", "qwen2.5", "phi4", "phi3", "mistral")
CACHE_MAX = 300
STATUS_SECONDS = 30            # how long "is a provider there?" is remembered
TIMEOUT = 120                  # a small model on an ordinary PC can take a while


class AiError(Exception):
    """A plain message for the person, such as "Ollama is not running"."""


def _post(url, body, headers=None, timeout=TIMEOUT):
    req = urllib.request.Request(url, data=json.dumps(body).encode("utf-8"), method="POST",
                                 headers={"Content-Type": "application/json", **(headers or {})})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8") or "{}")


def _get(url, timeout=2.0):
    with urllib.request.urlopen(url, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8") or "{}")


class Ollama:
    name = "Ollama on this PC"

    def __init__(self, url=OLLAMA_URL, model=None):
        self.url, self.model = url, model or os.environ.get("FRAMEDECKS_AI_MODEL") or None

    def available(self):
        try:
            tags = _get(self.url + "/api/tags")
        except (urllib.error.URLError, OSError, ValueError):
            return {"ok": False, "provider": self.name, "model": "", "reason": "Ollama is not running on this PC"}
        names = [str(m.get("name") or "") for m in tags.get("models") or [] if isinstance(m, dict)]
        if not names:
            return {"ok": False, "provider": self.name, "model": "",
                    "reason": "Ollama has no model yet (for example: ollama pull llama3.2)"}
        if self.model and not any(n == self.model or n.split(":")[0] == self.model for n in names):
            return {"ok": False, "provider": self.name, "model": self.model, "reason": f"The model {self.model} is not installed"}
        pick = self.model or next((n for p in PREFERRED for n in names if n.split(":")[0] == p), names[0])
        self.model = pick
        return {"ok": True, "provider": self.name, "model": pick, "reason": ""}

    def generate(self, prompt, system=""):
        try:
            out = _post(self.url + "/api/generate", {"model": self.model, "prompt": prompt, "system": system,
                                                       "stream": False, "format": "json", "options": {"temperature": 0.4}})
        except urllib.error.HTTPError as e:
            raise AiError(f"Ollama answered {e.code}")
        except (urllib.error.URLError, OSError, ValueError, TimeoutError):
            raise AiError("Ollama did not answer in time")
        return str(out.get("response") or "")


class Endpoint:
    """A self-hosted, OpenAI-compatible chat endpoint (Tier 2)."""
    name = "Self-hosted AI"

    def __init__(self, url, model, key=""):
        self.url, self.model, self.key = url.rstrip("/"), model, key

    def available(self):
        if not self.model:
            return {"ok": False, "provider": self.name, "model": "", "reason": "FRAMEDECKS_AI_MODEL is not set"}
        return {"ok": True, "provider": self.name, "model": self.model, "reason": ""}

    def generate(self, prompt, system=""):
        headers = {"Authorization": "Bearer " + self.key} if self.key else {}
        messages = ([{"role": "system", "content": system}] if system else []) + [{"role": "user", "content": prompt}]
        try:
            out = _post(self.url + "/v1/chat/completions", {"model": self.model, "messages": messages, "temperature": 0.4},
                        headers)
            return str(out["choices"][0]["message"]["content"] or "")
        except (urllib.error.URLError, OSError, ValueError, KeyError, IndexError, TypeError, TimeoutError):
            raise AiError("The AI server did not answer")


def provider():
    endpoint = os.environ.get("FRAMEDECKS_AI_ENDPOINT", "").strip()
    if endpoint:
        return Endpoint(endpoint, os.environ.get("FRAMEDECKS_AI_MODEL", ""), os.environ.get("FRAMEDECKS_AI_KEY", ""))
    return Ollama()


class Service:
    """What server.py uses: the provider's status (remembered briefly) and features with a cache."""

    def __init__(self, cache_file, enabled=lambda: True, make_provider=provider):
        self.cache_file = Path(cache_file)
        self.enabled, self.make_provider = enabled, make_provider
        self.lock = threading.Lock()
        self._status, self._status_at, self._provider = None, 0.0, None

    def status(self, fresh=False):
        if not self.enabled():
            return {"ok": False, "provider": "", "model": "", "reason": "AI is turned off"}
        with self.lock:
            if fresh or self._status is None or time.time() - self._status_at > STATUS_SECONDS:
                p = self.make_provider()
                self._status, self._status_at, self._provider = p.available(), time.time(), p
            return dict(self._status)

    # -- the cache --
    def _cache(self):
        try:
            d = json.loads(self.cache_file.read_text(encoding="utf-8"))
            return d if isinstance(d, dict) else {}
        except (OSError, ValueError):
            return {}

    def _remember(self, key, value):
        with self.lock:
            d = self._cache()
            d[key] = {"at": time.time(), "value": value}
            if len(d) > CACHE_MAX:
                for k in sorted(d, key=lambda k: d[k].get("at", 0))[:len(d) - CACHE_MAX]:
                    del d[k]
            tmp = self.cache_file.with_suffix(".tmp")
            tmp.write_text(json.dumps(d, ensure_ascii=False), encoding="utf-8")
            os.replace(tmp, self.cache_file)

    @staticmethod
    def _key(feature, model, data):
        return hashlib.sha256(json.dumps([feature, model, data], sort_keys=True, ensure_ascii=False).encode("utf-8")).hexdigest()

    # -- features --
    def discussion_questions(self, passages, count=5):
        """passages: [{"ref", "text"}] from the Frame's Scripture. Returns {"questions": [...], "cached", "model"}."""
        passages = [{"ref": str(p.get("ref") or "")[:120], "text": re.sub(r"\s+", " ", str(p.get("text") or ""))[:6000]}
                    for p in passages if isinstance(p, dict) and (p.get("ref") or p.get("text"))][:6]
        if not passages:
            raise AiError("Add the Bible passage to this Frame's Scripture first; the questions are drafted from it.")
        count = max(1, min(int(count or 5), 8))
        st = self.status()
        key = self._key("discussion_questions", st.get("model", ""), {"passages": passages, "count": count})
        hit = self._cache().get(key)
        if hit:
            return {"questions": hit["value"], "cached": True, "model": st.get("model", "")}
        if not st["ok"]:
            raise AiError(st["reason"] or "No AI is available")
        text = "\n\n".join(f"{p['ref']}\n{p['text']}".strip() for p in passages)
        system = ("You help a church small-group leader prepare a Bible study. You write open discussion questions "
                  "that help people observe the text, understand it in context, and apply it. Be faithful to the "
                  "passage, warm, and clear. Never invent verses. Answer only with JSON.")
        prompt = (f"Write {count} discussion questions for this passage. Mix observation, meaning and application; "
                  f"each question one sentence, under 30 words.\n\nPassage:\n{text}\n\n"
                  'Answer as JSON: {"questions": ["...", "..."]}')
        out = self._provider.generate(prompt, system)
        questions = parse_questions(out, count)
        if not questions:
            raise AiError("The AI's answer had no questions in it; try again.")
        self._remember(key, questions)
        return {"questions": questions, "cached": False, "model": st.get("model", "")}


def parse_questions(text, count):
    """The model's answer → clean, distinct questions (JSON first, else one per line)."""
    items = []
    try:
        data = json.loads(text)
        items = data.get("questions") if isinstance(data, dict) else data
    except ValueError:
        m = re.search(r"\{.*\}|\[.*\]", text or "", re.S)
        if m:
            try:
                data = json.loads(m.group(0))
                items = data.get("questions") if isinstance(data, dict) else data
            except ValueError:
                items = []
        if not items:
            items = (text or "").splitlines()
    out, seen = [], set()
    for q in items if isinstance(items, list) else []:
        q = re.sub(r"^\s*(?:[-*•]|\d+[.)]|Q\d*[:.])\s*", "", str(q or "")).strip().strip('"').strip()
        q = re.sub(r"\s+", " ", q)[:300]
        if len(q) < 8 or q.lower() in seen:
            continue
        seen.add(q.lower())
        out.append(q)
    return out[:count]
