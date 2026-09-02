#!/bin/bash
# Square (1:1) social card generator matching the Flowen_branding_example.PNG
# card style: coloured audience-tag pill top-left, bold headline, small Flowen
# wordmark bottom-left, on the dark brand surface. Text/waveform only — no
# photography (per this session's deterministic-assets decision).
#
# Usage: ./compose-square-card.sh <name> <size> "<tag>" "<tag_bg>" "<tag_fg>" "<headline>" <with_waveform:yes|no>
set -euo pipefail
cd "$(dirname "$0")"

SURFACE="#0F172A"
HEADLINE_COLOR="#F8FAFC"
WORDMARK_COLOR="#94A3B8"
FONT_BLACK="/Users/a1692/Library/Fonts/Inter-Black.ttf"
FONT_SEMIBOLD="/Users/a1692/Library/Fonts/Inter-SemiBold.ttf"
ICON_SVG="../logo/flowen-waveform-mark.svg"

name="$1"; size="$2"; tag="$3"; tag_bg="$4"; tag_fg="$5"; headline="$6"; with_waveform="$7"

pad=$(python3 -c "print(int($size*0.07))")
tag_size=$(python3 -c "print(max(14,int($size*0.032)))")
head_size=$(python3 -c "print(max(20,int($size*0.062)))")
wm_h=$(python3 -c "print(int($size*0.035))")
wm_w=$(python3 -c "print(int($wm_h*2))")

# base dark surface
magick -size "${size}x${size}" xc:"$SURFACE" "/tmp/sc-0-$$.png"

# optional large waveform visual centred in the card
if [ "$with_waveform" = "yes" ]; then
  wave_h=$(python3 -c "print(int($size*0.30))")
  rsvg-convert -h "$wave_h" "$ICON_SVG" -o "/tmp/sc-wave-$$.png"
  magick "/tmp/sc-0-$$.png" "/tmp/sc-wave-$$.png" -gravity center -geometry "+0-$(python3 -c "print(int($size*0.04))")" -compose over -composite "/tmp/sc-1-$$.png"
else
  cp "/tmp/sc-0-$$.png" "/tmp/sc-1-$$.png"
fi

# tag pill (rounded rect approximated with roundrectangle draw) — measure the
# label's real rendered width with ImageMagick itself rather than estimating
tag_text_w=$(magick -font "$FONT_SEMIBOLD" -pointsize "$tag_size" label:"$tag" -format "%w" info:)
tag_w=$(python3 -c "print(int($tag_text_w + $pad*0.9))")
tag_h=$(python3 -c "print(int($tag_size*2.0))")
tag_y=$pad

magick "/tmp/sc-1-$$.png" \
  -fill "$tag_bg" -draw "roundrectangle $pad,$tag_y $((pad+tag_w)),$((tag_y+tag_h)) 10,10" \
  "/tmp/sc-2-$$.png"

tag_text_y=$(python3 -c "print(int($tag_y + $tag_h*0.68))")
tag_text_x=$(python3 -c "print(int($pad + $pad*0.45))")
magick "/tmp/sc-2-$$.png" \
  -gravity NorthWest -font "$FONT_SEMIBOLD" -pointsize "$tag_size" -fill "$tag_fg" \
  -annotate "+${tag_text_x}+${tag_text_y}" "$tag" \
  "/tmp/sc-3-$$.png"

# headline, bottom-left, wrapped
magick -size "$(python3 -c "print(int($size-2*$pad))")x" -background none \
  -font "$FONT_BLACK" -pointsize "$head_size" -fill "$HEADLINE_COLOR" -gravity West \
  caption:"$headline" "/tmp/sc-head-$$.png"
magick "/tmp/sc-3-$$.png" "/tmp/sc-head-$$.png" \
  -gravity SouthWest -geometry "+${pad}+$(python3 -c "print(int($size*0.14))")" -compose over -composite \
  "/tmp/sc-4-$$.png"

# wordmark bottom-left corner
rsvg-convert -h "$wm_h" "$ICON_SVG" -o "/tmp/sc-wm-$$.png"
magick "/tmp/sc-4-$$.png" "/tmp/sc-wm-$$.png" -gravity SouthWest -geometry "+${pad}+${pad}" -compose over -composite "/tmp/sc-5-$$.png"
magick "/tmp/sc-5-$$.png" \
  -gravity SouthWest -font "$FONT_SEMIBOLD" -pointsize "$(python3 -c "print(int($wm_h*0.62))")" -fill "$WORDMARK_COLOR" \
  -annotate "+$(python3 -c "print(int($pad+$wm_w*1.15))")+$(python3 -c "print(int($pad+$wm_h*0.28))")" "Flowen" \
  "$name.png"

rm -f /tmp/sc-*-$$.png
echo "$name.png"
