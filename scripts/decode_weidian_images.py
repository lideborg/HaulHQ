#!/usr/bin/env python3
"""Decode base64 image data fetched via Playwright into local image files."""
import base64, json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SB = ROOT / "data" / "superbuy"

def decode(slug):
    raw = SB / "_raw" / f"{slug}-imgs.json"
    if not raw.exists():
        print(f"missing {raw}")
        return
    data = json.loads(raw.read_text())
    outdir = SB / "images" / slug
    outdir.mkdir(parents=True, exist_ok=True)
    paths = []
    for i, b64 in enumerate(data.get("images", [])):
        if not b64:
            continue
        ext = ".jpg"
        # Strip data URL prefix if any
        if "," in b64[:50]:
            head, b64 = b64.split(",", 1)
            if "png" in head:
                ext = ".png"
        try:
            raw_bytes = base64.b64decode(b64)
        except Exception as e:
            print(f"  decode failed at idx {i}: {e}")
            continue
        fname = f"g{i:03d}{ext}"
        target = outdir / fname
        target.write_bytes(raw_bytes)
        paths.append(f"images/{slug}/{fname}")
    # Update the JSON
    item_path = SB / f"{slug}.json"
    item = json.loads(item_path.read_text())
    item["local_image_paths"] = paths
    item_path.write_text(json.dumps(item, ensure_ascii=False, indent=2))
    print(f"  {slug}: saved {len(paths)} images")

if __name__ == "__main__":
    for slug in sys.argv[1:]:
        decode(slug)
