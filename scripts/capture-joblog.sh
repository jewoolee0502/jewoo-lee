#!/usr/bin/env bash
# Screenshots the Joblog live demo and optimizes it into public/img/projects/joblog.webp.
# Falls back to a 16:10 pixel Kanban placeholder when the capture fails (offline or blank page).
set -euo pipefail
cd "$(dirname "$0")/.."

CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
SHOT=/tmp/joblog.png
rm -f "$SHOT"

if "$CHROME" --headless=new --disable-gpu --hide-scrollbars \
  --window-size=1280,800 --virtual-time-budget=8000 --screenshot="$SHOT" https://joblog-nine.vercel.app \
  && [ -s "$SHOT" ] && [ "$(wc -c < "$SHOT")" -gt 20000 ]; then
  node scripts/optimize-images.mjs --one "$SHOT" joblog
else
  echo "capture failed or blank; writing the pixel placeholder" >&2
  node scripts/optimize-images.mjs --placeholder joblog
fi
