# Coursition pitch video — HyperFrames template

A reusable [HyperFrames](https://github.com/heygen-com/hyperframes) composition that turns
the Coursition story + real product screenshots into a deterministic 1080p MP4.

Output: `coursition-pitch.mp4` (1920×1080, 30fps, ~65s, with a **toggleable** subtitle track).

## Design direction

Dark **editorial "red-pen / study-notes"** — warm ink background, cream paper text, a single
vivid red-pen accent, paper grain, a hairline editorial frame, and an animated red
marker-underline on key words. Type: **Oswald** (condensed display), **EB Garamond italic**
(the founder's voice), **Space Mono** (labels/UI). Left-aligned, asymmetric, intentional —
no gradient-on-dark / Inter "AI slop".

## How it works

```
scenes.config.mjs        ← edit copy, narration, screenshots, pacing, marker words HERE
        │
        ├─ tools/build-voiceover.mjs → assets/voiceover.mp3 + data/timeline.json
        ├─ tools/build-subtitles.mjs → coursition-pitch.en.srt  (soft, toggleable)
        └─ tools/build-html.mjs      → index.html  (static composition; design system in CSS :root)
```

Markup: wrap a word in `«guillemets»` to give it the red marker underline (paper-colored text only).

## Commands

```bash
npm run build      # voiceover + subtitles + index.html  (run after editing the config)
npm run dev        # live preview in the browser (long-running)
npm run check      # lint + validate + inspect
npm run render     # render coursition-pitch.mp4 (no burned-in captions)
npm run package    # render + build subtitles + mux a toggleable subtitle track
```

Requirements: Node 22+, FFmpeg. Voiceover needs either a Boson key or macOS `say`.

## Voiceover — Boson Higgs Audio v3

`assets/voiceover.mp3` is synthesized as **one continuous take** (a single, consistent
voice — no per-line timbre drift). `tools/build-voiceover.mjs` then recovers per-line timing
by force-aligning the known script to **Whisper word timestamps** (`hyperframes transcribe`),
so captions and screenshot crossfades stay in sync. Provider resolves from `TTS.provider`:

- `auto` (default) — uses **Boson** (`higgs-audio-v3-tts`, voice `eleanor`) when `BOSON_API_KEY`
  is found in the environment or `.env.local`; otherwise falls back to macOS `say`.
- `boson` / `say` — force one.

```bash
export BOSON_API_KEY="bai-..."     # or put it in .env.local (gitignored)
export BOSON_TTS_VOICE="eleanor"   # chloe · eleanor · jake · marcus · nora · oliver
npm run build && npm run package
```

The key is never committed. To use a fully custom recording instead, drop your own
`assets/voiceover.mp3` and matching `data/timeline.json`.

## Subtitles — soft, toggleable (not burned in)

Captions are **not** rendered into the frame. `npm run package` muxes
`coursition-pitch.en.srt` as an `mov_text` track you toggle in the player
(QuickTime: **View ▸ Subtitles**). The `.srt` is also a usable sidecar.

## Screenshots

`assets/screens/*.png` are **real captures of the running Coursition app** for the
"Statistiks" (repeated-measures ANOVA) course. To recapture after UI changes, use
`../tools/set-demo-step.mjs` to pin a course to a step, then screenshot the
`/en/course-creation/<id>/<step>` route.

## Notes

- `overlapping_gsap_tweens` lint warnings + `GSAP target … not found` are benign: selectors are
  built by string concatenation (linter can't resolve them), and scenes without a `«marker»` simply
  have no `.swipe` to animate. Runtime is correct (`overwrite: 'auto'` on every opacity tween).
- **Fonts must be literal names** (`Oswald`, `"EB Garamond"`, `"Space Mono"`) in `font-family` —
  the renderer's font compiler can't follow CSS `var()` and would fall back to a generic font.
