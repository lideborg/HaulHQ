#!/bin/bash
# Download all Yupoo images locally to bypass hotlink protection.
set -e
cd "$(dirname "$0")/.."

YUPOO_DIR="data/yupoo"
IMG_DIR="data/yupoo/images"
mkdir -p "$IMG_DIR"

for json in "$YUPOO_DIR"/*.json; do
  base=$(basename "$json" .json)
  [ "$base" = "_index" ] && continue
  outdir="$IMG_DIR/$base"
  mkdir -p "$outdir"

  # Extract image URLs and also derive the album referer
  album_url=$(python3 -c "import json,sys; d=json.load(open('$json')); print(d['url'])")
  i=0
  python3 -c "import json; print('\n'.join(json.load(open('$json'))['image_urls']))" | while read url; do
    [ -z "$url" ] && continue
    # try medium first, fall back to small
    medium=${url/small.jpg/medium.jpg}
    fname=$(printf "%03d.jpg" "$i")
    if [ ! -f "$outdir/$fname" ]; then
      curl -s -H "Referer: $album_url" -o "$outdir/$fname" "$medium"
      # if medium failed (tiny/empty), try small
      if [ ! -s "$outdir/$fname" ] || [ "$(wc -c < "$outdir/$fname")" -lt 1000 ]; then
        curl -s -H "Referer: $album_url" -o "$outdir/$fname" "$url"
      fi
    fi
    i=$((i+1))
  done
  echo "✓ $base"
done
echo "Done."
