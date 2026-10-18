#!/usr/bin/env bash
# Builds the Vega package (.vpkg).
#
# The Vega toolchain (kepler-module-manifest-builder, invoked with an unquoted
# execSync) breaks when the project path contains spaces. If the project path
# has spaces, this script mirrors tv/ into a space-free directory, builds there
# and copies the resulting build/ back into tv/build/.
#
# Usage: scripts/build.sh [Debug|Release]      (default: Debug)
# Env:   VEGA_BUILD_DIR  mirror directory (default: /tmp/generala-tv-build)
set -euo pipefail

BUILD_TYPE="${1:-Debug}"
SRC="$(cd "$(dirname "$0")/.." && pwd)"

if [[ "$SRC" != *" "* ]]; then
  cd "$SRC"
  npx react-native build-vega --build-type "$BUILD_TYPE"
  exit 0
fi

DEST="${VEGA_BUILD_DIR:-/tmp/generala-tv-build}"
if [[ "$DEST" == *" "* ]]; then echo "VEGA_BUILD_DIR must not contain spaces" >&2; exit 1; fi
mkdir -p "$DEST"
echo "Project path contains spaces; building in mirror: $DEST"
rsync -a --delete --exclude /build --exclude /.tmp "$SRC/" "$DEST/"
cd "$DEST"
rm -rf "$DEST/build"   # stale intermediates (e.g. removed assets) would otherwise end up in the package
npx react-native build-vega --build-type "$BUILD_TYPE"
rm -rf "$SRC/build"
rsync -a "$DEST/build/" "$SRC/build/"
echo "Packages:"
find "$SRC/build" -name "*.vpkg" -print
