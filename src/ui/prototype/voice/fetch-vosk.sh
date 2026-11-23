#!/bin/sh
# PROTOTYPE (#177): vosk-browser reads a .tar.gz, the model is published as a .zip. Fetch it once and repack it into
# public/proto-voice/ (git-ignored). 82M.
set -eu
out="$(git rev-parse --show-toplevel)/public/proto-voice"
name=vosk-model-small-ko-0.22
[ -f "$out/$name.tar.gz" ] && { echo "있음: $out/$name.tar.gz"; exit 0; }
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
curl -fL -o "$tmp/$name.zip" "https://alphacephei.com/vosk/models/$name.zip"
python3 -c "import zipfile,sys; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])" "$tmp/$name.zip" "$tmp"
mkdir -p "$out"
# vosk-browser expects the archive's one top folder to be named "model".
mv "$tmp/$name" "$tmp/model"
tar -czf "$out/$name.tar.gz" -C "$tmp" model
echo "만듦: $out/$name.tar.gz"
