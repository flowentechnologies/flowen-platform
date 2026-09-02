#!/bin/bash
# 9:16 story/phone-mockup variant of compose-feature-post.sh: same blur+scrim+
# headline recipe, but a tall 1080x1920 canvas cropped from the TOP of the
# source screenshot (the above-the-fold content) rather than center — correct
# for the very tall full-page mobile captures used here.
#
# Usage:
#   ./compose-feature-story.sh <screenshot.png> <output.png> "<HEADLINE>" "<subtext>"
set -euo pipefail
cd "$(dirname "$0")"

SRC="$1"
OUT="$2"
HEADLINE="$3"
SUBTEXT="${4:-}"

LOCKUP="../logo-wordmark/flowen-wordmark-lockup.png"
FONT_BLACK="/Users/a1692/Library/Fonts/Inter-Black.ttf"
FONT_SEMIBOLD="/Users/a1692/Library/Fonts/Inter-SemiBold.ttf"
W=1080
H=1920

magick "$SRC" \
  -resize "${W}x${H}^" -gravity North -extent "${W}x${H}" \
  -blur 0x14 \
  "/tmp/fs-blur-$$.png"
magick "/tmp/fs-blur-$$.png" \( -size "${W}x${H}" xc:"#06080F" \) \
  -compose blend -define compose:args=78 -composite \
  "/tmp/fs-bg-$$.png"
rm -f "/tmp/fs-blur-$$.png"

magick "/tmp/fs-bg-$$.png" \
  -gravity center -font "$FONT_BLACK" -pointsize 74 -fill "#FFFFFF" \
  -size "$((W-140))x700" -background none caption:"$HEADLINE" \
  -gravity center -geometry "+0-40" -compose over -composite \
  "/tmp/fs-mid-$$.png"

if [ -n "$SUBTEXT" ]; then
  magick "/tmp/fs-mid-$$.png" \
    -gravity center -font "$FONT_SEMIBOLD" -pointsize 34 -fill "#D7DBE6" \
    -size "$((W-200))x260" -background none caption:"$SUBTEXT" \
    -gravity center -geometry "+0+260" -compose over -composite \
    "/tmp/fs-mid2-$$.png"
  mv "/tmp/fs-mid2-$$.png" "/tmp/fs-mid-$$.png"
fi

magick "/tmp/fs-mid-$$.png" \
  \( "$LOCKUP" -resize 340x \) -gravity south -geometry "+0+70" -compose over -composite \
  "$OUT"

rm -f /tmp/fs-*-$$.png
echo "$OUT"
