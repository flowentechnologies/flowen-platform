#!/bin/bash
# Compliance/trust badges square card — 2x2 grid of chip cards, matching the
# Flowen_branding_example.PNG badge grid. Labels are the exact, sourced
# compliance claims already published elsewhere in the codebase:
#   DCB0129  — src/app/page.tsx, media-kit, security page (NHS Digital
#              Clinical Safety Standard)
#   DTAC     — src/app/faq/page.tsx ("structured for NHS procurement under
#              the Digital Technology Assessment Criteria (DTAC)")
#   UK GDPR/DSPT — src/app/security/page.tsx, training/nhs/page.tsx
#   WCAG 2.1 AA  — src/app/admin/compliance/ComplianceClient.tsx
set -euo pipefail
cd "$(dirname "$0")"

SURFACE="#0F172A"
CHIP_BG="#1E293B"
LABEL_COLOR="#F8FAFC"
SUBLABEL_COLOR="#64748B"
CHECK_COLOR="#10B981"
WORDMARK_COLOR="#94A3B8"
FONT_BLACK="/Users/a1692/Library/Fonts/Inter-Black.ttf"
FONT_SEMIBOLD="/Users/a1692/Library/Fonts/Inter-SemiBold.ttf"
ICON_SVG="../logo/flowen-waveform-mark.svg"

size=1080
pad=$(python3 -c "print(int($size*0.07))")
gap=$(python3 -c "print(int($size*0.04))")
chip_w=$(python3 -c "print(int(($size - 2*$pad - $gap)/2))")
chip_h=$(python3 -c "print(int($chip_w*0.62))")
label_size=$(python3 -c "print(int($chip_w*0.10))")
sub_size=$(python3 -c "print(int($chip_w*0.062))")
check_d=$(python3 -c "print(int($chip_w*0.14))")

magick -size "${size}x${size}" xc:"$SURFACE" "/tmp/bd-0-$$.png"

draw_chip() {
  x="$1"; y="$2"; label="$3"; sub="$4"; src="$5"; dst="$6"
  magick "$src" -fill "$CHIP_BG" -draw "roundrectangle $x,$y $((x+chip_w)),$((y+chip_h)) 16,16" "/tmp/bd-a-$$.png"
  # green checkmark circle, top-left of chip
  cx=$((x + chip_w - check_d - 20)); cy=$((y + 20))
  magick "/tmp/bd-a-$$.png" -fill "$CHECK_COLOR" -draw "circle $((cx+check_d/2)),$((cy+check_d/2)) $((cx+check_d/2)),$cy" "/tmp/bd-b-$$.png"
  magick "/tmp/bd-b-$$.png" -gravity None -font "$FONT_BLACK" -pointsize "$((check_d*7/10))" -fill "$CHIP_BG" \
    -annotate "+$((cx+check_d/5))+$((cy+check_d*3/4))" "✓" "/tmp/bd-c-$$.png"
  magick "/tmp/bd-c-$$.png" -gravity None -font "$FONT_BLACK" -pointsize "$label_size" -fill "$LABEL_COLOR" \
    -annotate "+$((x+24))+$((y+chip_h/2))" "$label" "/tmp/bd-d-$$.png"
  magick "/tmp/bd-d-$$.png" -gravity None -font "$FONT_SEMIBOLD" -pointsize "$sub_size" -fill "$SUBLABEL_COLOR" \
    -annotate "+$((x+24))+$((y+chip_h/2+sub_size+14))" "$sub" "$dst"
}

x1=$pad; x2=$((pad+chip_w+gap))
y1=$pad; y2=$((pad+chip_h+gap))

draw_chip $x1 $y1 "DCB0129" "Clinical safety standard" "/tmp/bd-0-$$.png" "/tmp/bd-1-$$.png"
draw_chip $x2 $y1 "DTAC" "NHS procurement ready"   "/tmp/bd-1-$$.png" "/tmp/bd-2-$$.png"
draw_chip $x1 $y2 "UK GDPR / DSPT" "Data secured"    "/tmp/bd-2-$$.png" "/tmp/bd-3-$$.png"
draw_chip $x2 $y2 "WCAG 2.1 AA" "Accessible"          "/tmp/bd-3-$$.png" "/tmp/bd-4-$$.png"

wm_h=$(python3 -c "print(int($size*0.035))")
rsvg-convert -h "$wm_h" "$ICON_SVG" -o "/tmp/bd-wm-$$.png"
magick "/tmp/bd-4-$$.png" "/tmp/bd-wm-$$.png" -gravity SouthWest -geometry "+${pad}+${pad}" -compose over -composite "/tmp/bd-5-$$.png"
magick "/tmp/bd-5-$$.png" \
  -gravity SouthWest -font "$FONT_SEMIBOLD" -pointsize "$(python3 -c "print(int($wm_h*0.62))")" -fill "$WORDMARK_COLOR" \
  -annotate "+$(python3 -c "print(int($pad+$wm_h*2*1.15))")+$(python3 -c "print(int($pad+$wm_h*0.28))")" "Flowen" \
  "card-compliance-badges-1080.png"

rm -f /tmp/bd-*-$$.png
echo "card-compliance-badges-1080.png"
