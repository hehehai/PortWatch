#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ASSETS_DIR="$ROOT_DIR/Assets"
SOURCE_SVG="$ASSETS_DIR/portwatch.svg"
MASTER_PNG="$ASSETS_DIR/portwatch-icon.png"
ICONSET_DIR="$ASSETS_DIR/AppIcon.iconset"
ICONS_ICNS="$ASSETS_DIR/AppIcon.icns"
TMP_DIR="$ROOT_DIR/tmp/icongen"
PREVIEW_PNG="$TMP_DIR/portwatch.svg.png"

if [[ ! -f "$SOURCE_SVG" ]]; then
  echo "Missing icon source: $SOURCE_SVG" >&2
  exit 1
fi

mkdir -p "$TMP_DIR"
rm -rf "$ICONSET_DIR"
mkdir -p "$ICONSET_DIR"

qlmanage -t -s 1024 -o "$TMP_DIR" "$SOURCE_SVG" >/dev/null 2>&1
cp "$PREVIEW_PNG" "$MASTER_PNG"

make_icon() {
  local size="$1"
  local name="$2"
  sips -z "$size" "$size" "$MASTER_PNG" --out "$ICONSET_DIR/$name" >/dev/null
}

make_icon 16 icon_16x16.png
make_icon 32 icon_16x16@2x.png
make_icon 32 icon_32x32.png
make_icon 64 icon_32x32@2x.png
make_icon 128 icon_128x128.png
make_icon 256 icon_128x128@2x.png
make_icon 256 icon_256x256.png
make_icon 512 icon_256x256@2x.png
make_icon 512 icon_512x512.png
make_icon 1024 icon_512x512@2x.png

iconutil -c icns "$ICONSET_DIR" -o "$ICONS_ICNS"

echo "Generated:"
echo "  $MASTER_PNG"
echo "  $ICONS_ICNS"
