#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-run}"
APP_NAME="PortWatch"
BUNDLE_ID="com.doit.PortWatch"
MIN_SYSTEM_VERSION="14.0"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist"
APP_BUNDLE="$DIST_DIR/$APP_NAME.app"
APP_CONTENTS="$APP_BUNDLE/Contents"
APP_MACOS="$APP_CONTENTS/MacOS"
APP_RESOURCES="$APP_CONTENTS/Resources"
APP_FRAMEWORKS="$APP_CONTENTS/Frameworks"
APP_BINARY="$APP_MACOS/$APP_NAME"
INFO_PLIST="$APP_CONTENTS/Info.plist"
APP_ICON="$ROOT_DIR/Assets/AppIcon.icns"
APP_MENU_BAR_ICON="$ROOT_DIR/Assets/portwatch-icon.png"
APP_VERSION="${PORTWATCH_VERSION:-0.1.0}"
APP_BUILD="${PORTWATCH_BUILD:-1}"
SPARKLE_FEED_URL="${PORTWATCH_SU_FEED_URL:-}"
SPARKLE_PUBLIC_KEY="${PORTWATCH_SU_PUBLIC_KEY:-}"

pkill -x "$APP_NAME" >/dev/null 2>&1 || true

./script/generate_app_icon.sh

swift build
BUILD_PATH="$(swift build --show-bin-path)"
BUILD_BINARY="$BUILD_PATH/$APP_NAME"
SPARKLE_FRAMEWORK="$BUILD_PATH/Sparkle.framework"

if [[ ! -d "$SPARKLE_FRAMEWORK" ]]; then
  SPARKLE_FRAMEWORK="$(find "$ROOT_DIR/.build" -path '*Sparkle.framework' -type d | head -n 1)"
fi

rm -rf "$APP_BUNDLE"
mkdir -p "$APP_MACOS" "$APP_RESOURCES" "$APP_FRAMEWORKS"
cp "$BUILD_BINARY" "$APP_BINARY"
cp "$APP_ICON" "$APP_RESOURCES/AppIcon.icns"
cp "$APP_MENU_BAR_ICON" "$APP_RESOURCES/portwatch-icon.png"

if [[ -n "$SPARKLE_FRAMEWORK" && -d "$SPARKLE_FRAMEWORK" ]]; then
  ditto "$SPARKLE_FRAMEWORK" "$APP_FRAMEWORKS/Sparkle.framework"
  install_name_tool -add_rpath "@executable_path/../Frameworks" "$APP_BINARY" 2>/dev/null || true
fi

chmod +x "$APP_BINARY"

sparkle_plist_keys=""
if [[ -n "$SPARKLE_FEED_URL" ]]; then
  sparkle_plist_keys+="  <key>SUFeedURL</key>\n  <string>$SPARKLE_FEED_URL</string>\n"
fi
if [[ -n "$SPARKLE_PUBLIC_KEY" ]]; then
  sparkle_plist_keys+="  <key>SUPublicEDKey</key>\n  <string>$SPARKLE_PUBLIC_KEY</string>\n"
fi

cat >"$INFO_PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key>
  <string>$APP_NAME</string>
  <key>CFBundleIdentifier</key>
  <string>$BUNDLE_ID</string>
  <key>CFBundleIconFile</key>
  <string>AppIcon</string>
  <key>CFBundleName</key>
  <string>$APP_NAME</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>$APP_VERSION</string>
  <key>CFBundleVersion</key>
  <string>$APP_BUILD</string>
  <key>LSMinimumSystemVersion</key>
  <string>$MIN_SYSTEM_VERSION</string>
  <key>NSPrincipalClass</key>
  <string>NSApplication</string>
$(printf "%b" "$sparkle_plist_keys")
</dict>
</plist>
PLIST

codesign --force --deep --sign - "$APP_BUNDLE" >/dev/null 2>&1

open_app() {
  /usr/bin/open -n "$APP_BUNDLE"
}

case "$MODE" in
  run)
    open_app
    ;;
  --debug|debug)
    lldb -- "$APP_BINARY"
    ;;
  --logs|logs)
    open_app
    /usr/bin/log stream --info --style compact --predicate "process == \"$APP_NAME\""
    ;;
  --telemetry|telemetry)
    open_app
    /usr/bin/log stream --info --style compact --predicate "subsystem == \"$BUNDLE_ID\""
    ;;
  --verify|verify)
    open_app
    sleep 1
    pgrep -x "$APP_NAME" >/dev/null
    ;;
  *)
    echo "usage: $0 [run|--debug|--logs|--telemetry|--verify]" >&2
    exit 2
    ;;
esac
