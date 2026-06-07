# Boson Higgs Video Dubbing

Use this workflow to dub a screen-recorded Coursition video with Boson Higgs Audio v3 TTS.

## Secret

Never commit the Boson key. Inject it as an environment variable:

```bash
export BOSON_API_KEY="bai-..."
```

For local-only runs, an ignored `.env.local` file is also supported:

```bash
BOSON_API_KEY="bai-..."
BOSON_TTS_VOICE="eleanor"
```

## Default Dub

```bash
scripts/dub_with_boson_higgs.sh
```

This reads:

- video: `artifacts/coursition-product-walkthrough.mp4`
- narration: `artifacts/coursition-narration.txt`
- voice: `eleanor` unless `BOSON_TTS_VOICE` is set
- output: `artifacts/coursition-product-walkthrough-dubbed-boson.mp4`

## Custom Inputs

```bash
scripts/dub_with_boson_higgs.sh \
  path/to/input.mp4 \
  path/to/narration.txt \
  path/to/output-dubbed.mp4
```

Preset voices documented by Boson include `chloe`, `eleanor`, `jake`, `marcus`, `nora`, and `oliver`.

## Direct Python Command

```bash
scripts/higgs_dub.py dub \
  --provider boson \
  --voice eleanor \
  --text-file artifacts/coursition-narration.txt \
  --output-audio artifacts/coursition-boson-eleanor.mp3 \
  --input-video artifacts/coursition-product-walkthrough.mp4 \
  --output-video artifacts/coursition-product-walkthrough-dubbed-boson.mp4
```

## Notes for Devin

- The API endpoint is `POST https://api.boson.ai/v1/audio/speech`.
- The model is `higgs-audio-v3-tts`.
- The script sends `Authorization: Bearer $BOSON_API_KEY`.
- Keep narration under 5000 characters.
- Inline tags such as `<|emotion:enthusiasm|>` and `<|prosody:pause|>` are supported in the narration text.
- The generated audio is fit to the source video duration with `ffmpeg`, then muxed as AAC.
- The script also supports `--provider local` for a self-hosted SGLang server, but the hosted Boson API is the working Mac path.
