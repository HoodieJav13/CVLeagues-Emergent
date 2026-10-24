#!/bin/zsh
# Run the installed Blender headless inside a scratch boundary: HOME, TMPDIR
# and Blender's user resources are redirected so nothing touches the owner's
# Blender preferences, recent files or thumbnails. Factory startup, background
# mode, no add-ons, no network use. Usage: blender.sh <script.py> [-- args...]
set -eu
BLENDER=${BLENDER_BIN:-/Applications/Blender.app/Contents/MacOS/Blender}
SCRATCH=${REPLAY_BLENDER_SCRATCH:-${0:A:h}/../../.replay-scratch/blender}
mkdir -p "$SCRATCH/home" "$SCRATCH/tmp" "$SCRATCH/user"
SCRIPT=$1; shift
exec env -i PATH=/usr/bin:/bin HOME="$SCRATCH/home" TMPDIR="$SCRATCH/tmp" \
  BLENDER_USER_RESOURCES="$SCRATCH/user" \
  "$BLENDER" --factory-startup -b --python-exit-code 3 --python "$SCRIPT" "$@"
