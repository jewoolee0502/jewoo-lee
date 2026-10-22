#!/usr/bin/env bash
# Screenshots the Joblog live demo at 2× (1280×800 CSS px -> 2560×1600) into design/img/originals/joblog.png,
# then runs the image optimizer. Only a page visit: nothing is clicked or submitted.
# When the capture fails (offline or blank page) the existing original, or design/img/joblog.jpg, is kept.
set -euo pipefail
cd "$(dirname "$0")/.."

CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
SHOT=/tmp/joblog.png
rm -f "$SHOT"

if "$CHROME" --headless=new --disable-gpu --hide-scrollbars \
  --window-size=1280,800 --force-device-scale-factor=2 --virtual-time-budget=8000 \
  --screenshot="$SHOT" https://joblog-nine.vercel.app \
  && [ -s "$SHOT" ] && [ "$(wc -c < "$SHOT")" -gt 20000 ]; then
  WIDTH="$(sips -g pixelWidth "$SHOT" | awk '/pixelWidth/ { print $2 }')"
  if [ "${WIDTH:-0}" -ge 2000 ]; then
    mkdir -p design/img/originals
    cp "$SHOT" design/img/originals/joblog.png
  else
    echo "capture is only ${WIDTH:-?} px wide (expected at least 2000 at 2x); keeping the existing joblog source" >&2
  fi
else
  echo "capture failed or blank; keeping the existing joblog source" >&2
fi
node scripts/optimize-images.mjs
