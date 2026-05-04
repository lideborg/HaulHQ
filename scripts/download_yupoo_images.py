#!/usr/bin/env python3
"""Download all Yupoo images locally to bypass hotlink protection."""
import json
import os
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
YUPOO = ROOT / "data" / "yupoo"
IMG_ROOT = YUPOO / "images"
IMG_ROOT.mkdir(parents=True, exist_ok=True)

# Yupoo sometimes serves a tiny compressed/placeholder version (~1-5 KB) that
# isn't a real product photo. Anything below this threshold gets dropped so
# we don't ship junk to the frontend.
MIN_BYTES = 15_000


def fetch(url: str, referer: str) -> bytes | None:
    req = urllib.request.Request(url, headers={
        "Referer": referer,
        "User-Agent": "Mozilla/5.0",
    })
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.read()
    except Exception as e:
        return None


def main():
    files = sorted(p for p in YUPOO.glob("*.json") if not p.name.startswith("_"))
    for jf in files:
        data = json.loads(jf.read_text())
        slug = jf.stem
        outdir = IMG_ROOT / slug
        outdir.mkdir(exist_ok=True)
        local_paths = []
        for i, url in enumerate(data["image_urls"]):
            fname = f"{i:03d}.jpg"
            target = outdir / fname
            local_rel = f"images/{slug}/{fname}"
            if target.exists() and target.stat().st_size >= MIN_BYTES:
                local_paths.append(local_rel)
                continue
            medium = url.replace("/small.jpg", "/medium.jpg")
            big = url.replace("/small.jpg", "/big.jpg")
            body = fetch(big, data["url"]) or fetch(medium, data["url"]) or fetch(url, data["url"])
            if body and len(body) >= MIN_BYTES:
                target.write_bytes(body)
                local_paths.append(local_rel)
                sys.stdout.write(".")
                sys.stdout.flush()
            else:
                # too small => compressed thumb / placeholder; skip
                if target.exists():
                    target.unlink()
                sys.stdout.write("x")
                sys.stdout.flush()
        # Preserve any user-curated hero ordering: if the existing
        # local_image_paths starts with a path that's still valid, keep that
        # order (filtered to surviving paths) and append anything new.
        prev = data.get("local_image_paths") or []
        valid = set(local_paths)
        ordered = [p for p in prev if p in valid]
        for p in local_paths:
            if p not in ordered:
                ordered.append(p)
        data["local_image_paths"] = ordered
        jf.write_text(json.dumps(data, ensure_ascii=False, indent=2))
        print(f" ✓ {slug} ({len(local_paths)} imgs)")
    print("Done.")


if __name__ == "__main__":
    main()
