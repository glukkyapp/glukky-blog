#!/usr/bin/env bash
# One-off reproducible compression for the 11 diet-tip thumbnails on
# the Health Info page. The originals were ~145 MB at full camera
# resolution but render as ~100px circular thumbs. This script
# resizes them to 320x320 max (288x288 for the 3 most detailed images)
# and re-encodes with palette quantization to land each file under
# 200 KB and the total under 2 MB.
#
# Tooling: ImageMagick (already on the Replit Nix path).
# Usage:   bash scripts/compress-diet-tip-thumbnails.sh
set -euo pipefail

cd "$(dirname "$0")/.."
shopt -s nullglob

# Files needing extra-aggressive settings (palette-resistant content).
declare -A STRICT=(
  ["cropped_circle_image_(2)_1775372471300.png"]=1
  ["cropped_circle_image_(8)_1775372471301.png"]=1
  ["cropped_circle_image_(9)_1775374577700.png"]=1
)

for f in attached_assets/cropped_circle_image*.png; do
  name=$(basename "$f")
  if [[ -n "${STRICT[$name]:-}" ]]; then
    dim=288; colors=96
  else
    dim=320; colors=128
  fi
  before=$(stat -c%s "$f")
  magick "$f" \
    -resize "${dim}x${dim}>" \
    -strip \
    -dither FloydSteinberg \
    -colors "$colors" \
    -define png:compression-level=9 \
    -define png:compression-strategy=2 \
    "$f.tmp"
  mv "$f.tmp" "$f"
  after=$(stat -c%s "$f")
  printf "%-55s %6d KB -> %4d KB\n" "$name" $((before/1024)) $((after/1024))
done

echo
echo "Total bytes:"
du -bc attached_assets/cropped_circle_image*.png | tail -1
