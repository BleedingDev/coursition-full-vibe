#!/usr/bin/env bash
set -euo pipefail

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required" >&2
  exit 1
fi

if ! command -v nvidia-smi >/dev/null 2>&1; then
  cat >&2 <<'EOF'
This launcher requires an NVIDIA CUDA machine.

The official Higgs Audio v3 local path uses SGLang-Omni with Docker GPU
passthrough. This Mac has Apple Silicon, not CUDA, so the server cannot run
locally on this hardware through the supported path.
EOF
  exit 1
fi

docker pull lmsysorg/sglang-omni:dev
docker run --rm -it \
  --gpus all \
  --shm-size 32g \
  --ipc host \
  --network host \
  --privileged \
  -e HF_TOKEN="${HF_TOKEN:-}" \
  lmsysorg/sglang-omni:dev /bin/zsh -lc '
    set -euo pipefail
    if [ ! -d sglang-omni ]; then
      git clone https://github.com/sgl-project/sglang-omni.git
    fi
    cd sglang-omni
    uv venv .venv -p 3.12
    source .venv/bin/activate
    uv pip install -v -e .
    hf download bosonai/higgs-audio-v3-tts-4b
    exec sgl-omni serve --model-path bosonai/higgs-audio-v3-tts-4b --port 8000
  '
