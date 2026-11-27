#!/usr/bin/env bash
# Verifica el export en Godot 4.4.1 real (Compatibility, xvfb) y deja capturas en $OUT.
# Uso: GODOT=/ruta/Godot_v4.4.1-stable_linux.x86_64 scripts/godot-verify.sh "nombre:x,y,z,tx,ty,tz;otra:..." [NOFX=1]
set -e
GODOT=${GODOT:-/home/claude/godot/Godot_v4.4.1-stable_linux.x86_64}
OUT=${OUT:-/tmp/shots}; P=${PROJ:-/tmp/gdproj}
mkdir -p "$OUT"
node "$(dirname "$0")/godot-check.mjs" "$P" >/dev/null
timeout 170 "$GODOT" --headless --path "$P" --import >/dev/null 2>&1 || true
LF_SHOTS="$OUT" timeout 170 xvfb-run -a -s "-screen 0 1280x720x24" "$GODOT" --path "$P" --rendering-driver opengl3 --resolution 1024x640 -- "--shot=${1:-}" 2>&1 \
  | grep -E "CHECK_|ERROR|SCRIPT ERROR|Parse Error|Condition|Failed" | grep -vE "ALSA|status < 0|ERR_CANT_OPEN|audio" || true
