#!/usr/bin/env python3
"""Download Superbuy item images (Taobao/Weidian/1688 origin via alicdn/wd-cdn)."""
import json
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SUPERBUY = ROOT / "data" / "superbuy"
IMG_ROOT = SUPERBUY / "images"
IMG_ROOT.mkdir(parents=True, exist_ok=True)


def fetch(url: str, referer: str) -> bytes | None:
    req = urllib.request.Request(url, headers={
        "Referer": referer,
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    })
    try:
        with urllib.request.urlopen(req, timeout=25) as r:
            return r.read()
    except Exception:
        return None


def ext_of(url: str) -> str:
    base = url.split("?")[0].lower()
    for e in (".jpg", ".jpeg", ".png", ".webp", ".gif"):
        if e in base:
            return ".jpg" if e in (".jpeg",) else e
    return ".jpg"


def download_item(slug: str, urls: list[str], referer: str, prefix: str = "") -> list[str]:
    outdir = IMG_ROOT / slug
    outdir.mkdir(exist_ok=True)
    local = []
    for i, url in enumerate(urls):
        fname = f"{prefix}{i:03d}{ext_of(url)}"
        target = outdir / fname
        rel = f"images/{slug}/{fname}"
        local.append(rel)
        if target.exists() and target.stat().st_size > 1000:
            continue
        body = fetch(url, referer)
        if body and len(body) > 500:
            target.write_bytes(body)
            sys.stdout.write(".")
        else:
            sys.stdout.write("x")
        sys.stdout.flush()
    return local


def main():
    files = sorted(p for p in SUPERBUY.glob("*.json") if not p.name.startswith("_"))
    for jf in files:
        data = json.loads(jf.read_text())
        slug = jf.stem
        gallery = data.get("image_urls", [])
        detail = data.get("detail_image_urls", [])
        ref = data.get("url", "https://www.superbuy.com/")
        local_gallery = download_item(slug, gallery, ref, prefix="g")
        local_detail = download_item(slug, detail, ref, prefix="d") if detail else []
        data["local_image_paths"] = local_gallery
        data["local_detail_image_paths"] = local_detail
        jf.write_text(json.dumps(data, ensure_ascii=False, indent=2))
        print(f" {slug} (gallery={len(local_gallery)}, detail={len(local_detail)})")
    print("Done.")


if __name__ == "__main__":
    main()
