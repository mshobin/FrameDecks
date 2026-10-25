# Suggested discussion questions (free AI on your PC)

FRAMEDECKS can draft discussion questions from the Bible passage in a Frame. A free AI program, **Ollama**, writes
them on your own PC. Nothing is sent to the internet, it costs nothing, and it works offline. Without Ollama nothing
changes: the **Suggest** button simply does not appear.

**Who this is for:** leaders who prepare Bible studies in FRAMEDECKS, and whoever sets up the church PC.

## Set it up once

1. Download and install Ollama for Windows from https://ollama.com (free and open source).
2. Open **Command Prompt** and download a small model (about 2 GB, once):
   ```
   ollama pull llama3.2
   ```
   On an older PC, `ollama pull phi3` is smaller. FRAMEDECKS picks the first model it finds, in this order:
   Llama 3.2, Llama 3.1, Gemma, Qwen 2.5, Phi, Mistral. Any other installed model is used if none of these is.
3. Leave Ollama running; it starts with Windows. Within two minutes the **Suggest** button appears in FRAMEDECKS.

## Use it

1. Select a Frame that has a **Scripture** Content with the passage, for example John 3:16. A reference is enough
   when the text is in the ESV offline cache or your ESV key is set.
2. Select its **Question** Content → **Content** → **Suggest**.
3. The drafted questions open in the **Add several** box. Read them, change or delete any, then **Add to this Frame**.
   Nothing is added until you choose.

The same passage asked again comes from FRAMEDECKS's own cache (`kc-ai-cache.json` in the data folder), at once and
offline. Pressing **Suggest** again asks for a new draft only after you change the passage.

## Good to know

- **The questions are a draft.** Check them against the passage before the study, as you would anyone's notes.
- **Speed.** A small model on an ordinary PC takes from a few seconds to about a minute.
- **Turning it off.** Quit Ollama, or set `"ai": "off"` in `kc-app-settings.json` in the data folder.
- **A church server instead.** For a shared AI server that speaks the OpenAI-compatible API, set these environment
  variables on the PC:
  - `FRAMEDECKS_AI_ENDPOINT`: the server's address;
  - `FRAMEDECKS_AI_MODEL`: the model;
  - `FRAMEDECKS_AI_KEY`: its key, if it needs one.
- **Paid AI services are never required**, and FRAMEDECKS never sends your text to one.

For maintainers: `ai.py` (provider interface, Ollama, self-hosted endpoint, cache), `server.py` (`/api/ai/status` and
`/api/ai/questions`, this PC only), `app/js/frame-lists.js` (the button). Design: [architecture-review.md](architecture-review.md) §6.
