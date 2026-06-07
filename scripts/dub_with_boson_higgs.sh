#!/usr/bin/env bash
set -euo pipefail

if [ -f .env.local ]; then
  set -a
  # shellcheck disable=SC1091
  source .env.local
  set +a
fi

if [ -z "${BOSON_API_KEY:-}" ]; then
  echo "Set BOSON_API_KEY before running this script." >&2
  exit 1
fi

INPUT_VIDEO="${1:-artifacts/coursition-product-walkthrough.mp4}"
TEXT_FILE="${2:-artifacts/coursition-narration.txt}"
OUTPUT_VIDEO="${3:-artifacts/coursition-product-walkthrough-dubbed-boson.mp4}"
VOICE="${BOSON_TTS_VOICE:-eleanor}"
AUDIO_FILE="${OUTPUT_VIDEO%.*}-${VOICE}.mp3"

scripts/higgs_dub.py dub \
  --provider boson \
  --voice "$VOICE" \
  --text-file "$TEXT_FILE" \
  --output-audio "$AUDIO_FILE" \
  --input-video "$INPUT_VIDEO" \
  --output-video "$OUTPUT_VIDEO"
