#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ASSETS_DIR="$ROOT_DIR/Assets"
MASTER_SOURCE_PNG="$ASSETS_DIR/portwatch-logo.png"
MASTER_PNG="$ASSETS_DIR/portwatch-icon.png"
MENU_BAR_SVG="$ASSETS_DIR/menu-bar-icon.svg"
MENU_BAR_PNG="$ASSETS_DIR/menu-bar-icon.png"
ICONSET_DIR="$ASSETS_DIR/AppIcon.iconset"
ICONS_ICNS="$ASSETS_DIR/AppIcon.icns"
WINDOWS_ICO="$ASSETS_DIR/portwatch.ico"

if [[ -f "$MASTER_SOURCE_PNG" ]]; then
  sips -z 1024 1024 "$MASTER_SOURCE_PNG" --out "$MASTER_PNG" >/dev/null
fi

if [[ ! -f "$MASTER_PNG" ]]; then
  echo "Missing icon source PNG: $MASTER_SOURCE_PNG or $MASTER_PNG" >&2
  exit 1
fi

if [[ -f "$MENU_BAR_SVG" ]]; then
  sips -s format png "$MENU_BAR_SVG" --out "$MENU_BAR_PNG" >/dev/null
  sips -z 64 64 "$MENU_BAR_PNG" --out "$MENU_BAR_PNG" >/dev/null
fi

rm -rf "$ICONSET_DIR"
mkdir -p "$ICONSET_DIR"

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

if command -v ffmpeg >/dev/null 2>&1; then
  ffmpeg -y -loglevel error \
    -i "$MASTER_PNG" \
    -vf "scale=256:256" \
    -frames:v 1 \
    "$WINDOWS_ICO"
fi

echo "Generated:"
echo "  $MASTER_PNG"
echo "  $ICONS_ICNS"
if [[ -f "$WINDOWS_ICO" ]]; then
  echo "  $WINDOWS_ICO"
fi
if [[ -f "$MENU_BAR_PNG" ]]; then
  echo "  $MENU_BAR_PNG"
fi
