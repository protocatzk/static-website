#!/usr/bin/env bash
# Download v86 BIOS/wasm/kernel and build the bash overlay initrd.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/public/v86"
mkdir -p "$OUT"

echo "→ $OUT"

# BIOS from v86 repo
curl -fsSL --compressed -o "$OUT/seabios.bin" \
  "https://raw.githubusercontent.com/copy/v86/master/bios/seabios.bin"
curl -fsSL --compressed -o "$OUT/vgabios.bin" \
  "https://raw.githubusercontent.com/copy/v86/master/bios/vgabios.bin"

# Official v86 test image CDN (Buildroot kernel + BusyBox rootfs)
curl -fL --compressed -o "$OUT/buildroot-bzimage.bin" \
  "https://i.copy.sh/buildroot-bzimage.bin"

# Prefer wasm + lib from installed npm package
if [[ -f "$ROOT/node_modules/v86/build/v86.wasm" ]]; then
  cp "$ROOT/node_modules/v86/build/v86.wasm" "$OUT/v86.wasm"
  cp "$ROOT/node_modules/v86/build/libv86.mjs" "$OUT/libv86.mjs"
else
  echo "node_modules/v86 missing — run: yarn add v86" >&2
  exit 1
fi

# GNU bash overlay (Alpine i386 packages → uncompressed cpio initrd)
bash "$ROOT/scripts/build-bash-overlay.sh"

ls -lah "$OUT"
echo "OK — assets ready."
