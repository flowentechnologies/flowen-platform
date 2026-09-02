#!/bin/bash
# Wide banner generator matching the Flowen_branding_example.PNG desktop-banner
# layout: small waveform icon on the left, stacked headline + subtitle to its
# right, on the dark brand background. Uses the locked official waveform mark
# (brandkit/logo/flowen-waveform-mark.svg) and Inter Black/SemiBold — same
# assets as every other banner built this session. No new logo, no redesign.
#
# Usage: ./compose-wide-banner.sh <name> <width> <height> "<headline>" "<subtitle>"
set -euo pipefail
cd "$(dirname "$0")"

BG="#06080F"
HEADLINE_COLOR="#F8FAFC"
SUBTITLE_COLOR="#94A3B8"
FONT_BLACK="/Users/a1692/Library/Fonts/Inter-Black.ttf"
FONT_SEMIBOLD="/Users/a1692/Library/Fonts/Inter-SemiBold.ttf"
ICON_SVG="../logo/flowen-waveform-mark.svg"

name="$1"; w="$2"; h="$3"; headline="$4"; subtitle="$5"

icon_h=$(python3 -c "print(int($h*0.58))")
icon_w=$(python3 -c "print(int($icon_h*2))")   # waveform mark viewBox is 120x60 (2:1)
icon_x=$(python3 -c "print(int($h*0.32))")
text_x=$(python3 -c "print(int($h*0.32*2 + $icon_w))")
head_size=$(python3 -c "print(max(16,int($h*0.19)))")
sub_size=$(python3 -c "print(max(12,int($h*0.11)))")
head_y=$(python3 -c "print(-int($h*0.10))")
sub_y=$(python3 -c "print(int($h*0.16))")

rsvg-convert -h "$icon_h" "$ICON_SVG" -o "/tmp/wb-icon-$$.png"

magick -size "${w}x${h}" xc:"$BG" \
  "/tmp/wb-icon-$$.png" -gravity West -geometry "+${icon_x}+0" -compose over -composite \
  "/tmp/wb-1-$$.png"

magick "/tmp/wb-1-$$.png" \
  -gravity West -font "$FONT_BLACK" -pointsize "$head_size" -fill "$HEADLINE_COLOR" \
  -annotate "+${text_x}+${head_y}" "$headline" \
  "/tmp/wb-2-$$.png"

magick "/tmp/wb-2-$$.png" \
  -gravity West -font "$FONT_SEMIBOLD" -pointsize "$sub_size" -fill "$SUBTITLE_COLOR" \
  -annotate "+${text_x}+${sub_y}" "$subtitle" \
  "$name.png"

rm -f "/tmp/wb-icon-$$.png" "/tmp/wb-1-$$.png" "/tmp/wb-2-$$.png"
echo "$name.png"
