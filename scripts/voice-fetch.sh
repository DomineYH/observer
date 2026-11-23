#!/bin/sh
# npm run voice:fetch — the 음성 모델 (vosk small-ko 0.22, Apache-2.0, 82 MiB) is not in the repository (ADR 0023).
# Fetches the published .zip once, checks it, and repacks it as the .tar.gz vosk-browser reads, into public/voice/
# (git-ignored). The page fetches that file from its own origin when 음성 입력 is turned on. CI does not run this.
# VOSK_ZIP=<file> uses a copy already downloaded.
set -eu
name=vosk-model-small-ko-0.22
sha=eea36124087fed26c59996a4761519458e3bd185e8ea9d9865ad8760c4a1d989
out="$(git rev-parse --show-toplevel)/public/voice"
[ -f "$out/$name.tar.gz" ] && { echo "있음: $out/$name.tar.gz"; exit 0; }
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
zip="${VOSK_ZIP:-$tmp/$name.zip}"
[ -f "$zip" ] || curl -fL -o "$zip" "https://alphacephei.com/vosk/models/$name.zip"
echo "$sha  $zip" | sha256sum -c - >/dev/null || { echo "체크섬이 다르다: $zip" >&2; exit 1; }
python3 -c "import zipfile,sys; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])" "$zip" "$tmp"
# vosk-browser expects the archive's one top folder to be named "model".
mv "$tmp/$name" "$tmp/model"
mkdir -p "$out"
# Packed under another name and renamed when whole: a run cut short leaves no file that the next run takes for the model.
part="$out/$name.tar.gz.part"
trap 'rm -rf "$tmp" "$part"' EXIT
tar -czf "$part" -C "$tmp" model
mv "$part" "$out/$name.tar.gz"
echo "만듦: $out/$name.tar.gz"
