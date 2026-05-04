#!/usr/bin/env python3
"""One-shot cleanup: trim detail images to a max, add explicit price_usd."""
import json, re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SB = ROOT / "data" / "superbuy"
CNY_PER_USD = 6.83
MAX_DETAIL = 10
MAX_GALLERY = 10

# user-supplied USD overrides where Superbuy's printed USD is reliable
USD_OVERRIDES = {
    "row-bag": "$253.31",
    "glasses-no-4": "$55.42",
    "glasses-red-grey-frame-green": "$38–$41.17",
    "glasses-gold-frames-optics-green": "$31.51",
}

def cny_to_usd(price_str):
    if not price_str:
        return None
    m = re.search(r"[¥￥]\s*(\d+(?:\.\d+)?)", price_str)
    if not m:
        return None
    cny = float(m.group(1))
    return f"${cny / CNY_PER_USD:.2f}"

for jf in sorted(SB.glob("*.json")):
    if jf.name.startswith("_"):
        continue
    data = json.loads(jf.read_text())
    slug = jf.stem
    # Trim detail images
    if "detail_image_urls" in data and len(data["detail_image_urls"]) > MAX_DETAIL:
        data["detail_image_urls"] = data["detail_image_urls"][:MAX_DETAIL]
    if "local_detail_image_paths" in data and len(data["local_detail_image_paths"]) > MAX_DETAIL:
        data["local_detail_image_paths"] = data["local_detail_image_paths"][:MAX_DETAIL]
    if "image_urls" in data and len(data["image_urls"]) > MAX_GALLERY:
        data["image_urls"] = data["image_urls"][:MAX_GALLERY]
    if "local_image_paths" in data and len(data["local_image_paths"]) > MAX_GALLERY:
        data["local_image_paths"] = data["local_image_paths"][:MAX_GALLERY]
    # Add price_usd and `price` alias (web app reads `price`)
    usd = USD_OVERRIDES.get(slug) or cny_to_usd(data.get("price_rmb"))
    if usd:
        data["price_usd"] = usd
    if data.get("price_rmb") and not data.get("price"):
        data["price"] = data["price_rmb"]
    # Drop sizing fields on non-clothing categories
    if data.get("category") in ("eyewear", "bag", "accessory"):
        data["needs_sizing_parse"] = False
        # Keep eyewear frame measurements as-is in size_chart (useful spec) but flag clearly
    jf.write_text(json.dumps(data, ensure_ascii=False, indent=2))
    print(f"trimmed {slug} → gallery={len(data.get('local_image_paths', []))} detail={len(data.get('local_detail_image_paths', []))} usd={data.get('price_usd')}")
