#!/usr/bin/env python3
"""Generate Higgs TTS audio with Boson or local SGLang and dub a video."""

from __future__ import annotations

import argparse
import base64
import json
import math
import mimetypes
import os
import shutil
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request
from pathlib import Path


DEFAULT_BOSON_ENDPOINT = "https://api.boson.ai/v1/audio/speech"
DEFAULT_LOCAL_ENDPOINT = "http://127.0.0.1:8000/v1/audio/speech"


def run(command: list[str]) -> None:
    print("+ " + " ".join(command), flush=True)
    subprocess.run(command, check=True)


def capture(command: list[str]) -> str:
    return subprocess.check_output(command, text=True).strip()


def require_tool(name: str) -> None:
    if shutil.which(name) is None:
        raise SystemExit(f"Missing required command: {name}")


def media_duration(path: Path) -> float:
    output = capture(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "json",
            str(path),
        ]
    )
    duration = json.loads(output)["format"]["duration"]
    return float(duration)


def atempo_chain(speed: float) -> str:
    parts: list[str] = []
    remaining = speed
    while remaining > 2.0:
        parts.append("atempo=2.0")
        remaining /= 2.0
    while remaining < 0.5:
        parts.append("atempo=0.5")
        remaining /= 0.5
    parts.append(f"atempo={remaining:.6f}")
    return ",".join(parts)


def reference_audio_payload(path_or_url: str) -> str:
    if path_or_url.startswith(("http://", "https://", "data:")):
        return path_or_url

    path = Path(path_or_url)
    mime_type = mimetypes.guess_type(path.name)[0] or "audio/wav"
    encoded = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:{mime_type};base64,{encoded}"


def build_payload(args: argparse.Namespace) -> dict[str, object]:
    text = args.text_file.read_text(encoding="utf-8").strip()
    if not text:
        raise SystemExit(f"Narration file is empty: {args.text_file}")

    if len(text) > 5000:
        raise SystemExit("Boson TTS input is limited to 5000 characters.")

    if args.provider == "boson":
        payload: dict[str, object] = {
            "input": text,
            "model": args.model,
            "voice": args.voice,
            "response_format": args.response_format,
            "stream": False,
        }
        if args.reference_audio:
            payload.pop("voice", None)
            payload["ref_audio"] = reference_audio_payload(args.reference_audio)
            if args.reference_text:
                payload["ref_text"] = args.reference_text
        return payload

    payload = {
        "input": text,
        "temperature": args.temperature,
        "top_k": args.top_k,
        "max_new_tokens": args.max_new_tokens,
    }
    if args.reference_audio:
        reference: dict[str, str] = {"audio_path": args.reference_audio}
        if args.reference_text:
            reference["text"] = args.reference_text
        payload["references"] = [reference]
    return payload


def request_headers(args: argparse.Namespace) -> dict[str, str]:
    headers = {"Content-Type": "application/json"}
    if args.provider == "boson":
        api_key = args.api_key or os.environ.get(args.api_key_env)
        if not api_key:
            raise SystemExit(
                f"Set {args.api_key_env} or pass --api-key before using Boson."
            )
        headers["Authorization"] = f"Bearer {api_key}"
    return headers


def synthesize(args: argparse.Namespace) -> None:
    request = urllib.request.Request(
        args.endpoint,
        data=json.dumps(build_payload(args)).encode("utf-8"),
        headers=request_headers(args),
        method="POST",
    )

    print(f"Requesting Higgs audio from {args.endpoint}", flush=True)
    try:
        with urllib.request.urlopen(request, timeout=args.timeout) as response:
            body = response.read()
            content_type = response.headers.get("Content-Type", "")
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise SystemExit(f"Higgs TTS request failed with HTTP {exc.code}: {body}") from exc
    except urllib.error.URLError as exc:
        if args.provider == "boson":
            message = f"Could not reach Boson API at {args.endpoint}."
        else:
            message = (
                "Could not reach the local Higgs server. Start SGLang-Omni first "
                "or pass --endpoint."
            )
        raise SystemExit(
            f"{message} Error: {exc}"
        ) from exc

    if content_type.startswith("application/json"):
        raise SystemExit(body.decode("utf-8", errors="replace"))

    args.output_audio.parent.mkdir(parents=True, exist_ok=True)
    args.output_audio.write_bytes(body)
    print(f"Wrote {args.output_audio}", flush=True)


def fit_audio(input_audio: Path, output_audio: Path, target_seconds: float) -> None:
    actual_seconds = media_duration(input_audio)
    if actual_seconds <= 0:
        raise SystemExit(f"Audio duration is invalid: {input_audio}")

    ratio = actual_seconds / target_seconds
    if math.isclose(ratio, 1.0, rel_tol=0.03):
        filters = "aresample=48000"
    elif ratio > 1.0:
        filters = f"{atempo_chain(ratio)},aresample=48000"
    else:
        pad_seconds = target_seconds - actual_seconds
        filters = f"apad=pad_dur={pad_seconds:.3f},aresample=48000"

    run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(input_audio),
            "-af",
            filters,
            "-t",
            f"{target_seconds:.3f}",
            "-ac",
            "2",
            str(output_audio),
        ]
    )


def mux(args: argparse.Namespace) -> None:
    require_tool("ffmpeg")
    require_tool("ffprobe")

    video_seconds = media_duration(args.input_video)
    args.output_video.parent.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory(prefix="higgs-dub-") as temp_dir:
        fitted_audio = Path(temp_dir) / "narration-fitted.wav"
        fit_audio(args.input_audio, fitted_audio, video_seconds)
        run(
            [
                "ffmpeg",
                "-y",
                "-i",
                str(args.input_video),
                "-i",
                str(fitted_audio),
                "-map",
                "0:v:0",
                "-map",
                "1:a:0",
                "-c:v",
                "copy",
                "-c:a",
                "aac",
                "-b:a",
                "192k",
                "-shortest",
                str(args.output_video),
            ]
        )
    print(f"Wrote {args.output_video}", flush=True)


def dub(args: argparse.Namespace) -> None:
    synthesize(args)
    args.input_audio = args.output_audio
    mux(args)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)

    common_tts = argparse.ArgumentParser(add_help=False)
    common_tts.add_argument("--provider", choices=["boson", "local"], default="boson")
    common_tts.add_argument("--endpoint")
    common_tts.add_argument("--text-file", type=Path, required=True)
    common_tts.add_argument("--output-audio", type=Path, required=True)
    common_tts.add_argument("--api-key")
    common_tts.add_argument("--api-key-env", default="BOSON_API_KEY")
    common_tts.add_argument("--model", default="higgs-audio-v3-tts")
    common_tts.add_argument("--voice", default="eleanor")
    common_tts.add_argument(
        "--response-format",
        choices=["mp3", "opus", "pcm", "wav", "aac", "flac"],
        default="mp3",
    )
    common_tts.add_argument("--temperature", type=float, default=0.8)
    common_tts.add_argument("--top-k", type=int, default=50)
    common_tts.add_argument("--max-new-tokens", type=int, default=1024)
    common_tts.add_argument("--timeout", type=int, default=600)
    common_tts.add_argument("--reference-audio")
    common_tts.add_argument("--reference-text")

    speak_parser = subparsers.add_parser("speak", parents=[common_tts])
    speak_parser.set_defaults(func=synthesize)

    mux_parser = subparsers.add_parser("mux")
    mux_parser.add_argument("--input-video", type=Path, required=True)
    mux_parser.add_argument("--input-audio", type=Path, required=True)
    mux_parser.add_argument("--output-video", type=Path, required=True)
    mux_parser.set_defaults(func=mux)

    dub_parser = subparsers.add_parser("dub", parents=[common_tts])
    dub_parser.add_argument("--input-video", type=Path, required=True)
    dub_parser.add_argument("--output-video", type=Path, required=True)
    dub_parser.set_defaults(func=dub)

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    if "endpoint" in args and args.endpoint is None:
        args.endpoint = (
            DEFAULT_BOSON_ENDPOINT
            if args.provider == "boson"
            else DEFAULT_LOCAL_ENDPOINT
        )
    try:
        args.func(args)
    except subprocess.CalledProcessError as exc:
        return exc.returncode
    return 0


if __name__ == "__main__":
    sys.exit(main())
