#!/usr/bin/env python3
"""Save a Superbuy item JSON from a raw extraction file.

Usage: save_superbuy_item.py <raw_json_path> <slug> <user_label> <platform> <source_url>
The raw JSON has: title, priceRmb, priceUsd, sizes, colors, sellerId, gallery (urls), detail (urls), params

Auto-fills brand/category from user_label heuristics. Description = title_translated stub.
"""
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SB = ROOT / "data" / "superbuy"

BRAND_MAP = {
    "TR": "The Row (rep)",
    "Row": "The Row (rep)",
    "ROW": "The Row (rep)",
    "ERD": "Enfants Riches Déprimés (rep)",
    "Lem": "LEMAIRE (rep)",
    "LEM": "LEMAIRE (rep)",
    "LM": "LEMAIRE (rep)",
    "Prada": "Prada (rep)",
    "Yohji": "Yohji Yamamoto (rep)",
    "Off white": "Off-White (rep)",
    "Bolo": "Bolo (style)",
    "Blair": "Blair Witch (graphic)",
    "Glasses": None,
    "Tie": None,
    "Tall": None,
    "Raw": "The Row (rep)",
    "Gats": "MVT",
}

def guess_brand(label):
    for prefix, brand in BRAND_MAP.items():
        if re.match(rf"\b{re.escape(prefix)}\b", label, re.IGNORECASE) or label.lower().startswith(prefix.lower()):
            return brand
    return None

def guess_category(label, title, sizes):
    L = (label + " " + (title or "")).lower()
    if any(w in L for w in ["pant", "trouser", "shorts", "jean"]):
        return "apparel-bottom"
    if any(w in L for w in ["shirt", "tee", "t-shirt", "sweater", "knit", "blazer", "jacket", "suit", "suite", "coat", "tank", "polo", "hoodie", "top"]):
        return "apparel-top"
    if any(w in L for w in ["shoe", "sneaker", "boot", "loafer"]):
        return "shoes"
    if any(w in L for w in ["bag", "tote", "backpack"]):
        return "bag"
    if any(w in L for w in ["belt", "tie", "wallet", "scarf"]):
        return "accessory"
    if any(w in L for w in ["glass", "frame", "sunglass", "eyewear"]):
        return "eyewear"
    # fallback: if sizes look like clothing, guess top
    if sizes and any(re.match(r"^[XS|S|M|L|XL]", s) for s in sizes):
        return "apparel-top"
    return None

def clean_params(params):
    DROP_RE = re.compile(r"Prohibited|Do not accept|Europe|EMS|UPS|EUB|CDs|Medicine|Health|Battered|Power Bank|volumetric|Logistics|Parcel|inspection|Shopping Agent|Detailed Inspection|Pack with|Perfume|Gas|Insurance|Not yet|packaging details|fragile", re.IGNORECASE)
    return {k: v for k, v in (params or {}).items() if not DROP_RE.search(k)}

def main():
    raw_path, slug, user_label, platform, source_url = sys.argv[1:6]
    raw = json.loads(Path(raw_path).read_text())
    out = SB / f"{slug}.json"
    if out.exists():
        existing = json.loads(out.read_text())
    else:
        existing = {}

    title = raw.get("title") or ""
    sizes = raw.get("sizes") or []
    sizes = [s for s in sizes if not s.startswith("Size") and not s.startswith("Selected")]  # filter parser noise
    colors = raw.get("colors") or []
    colors = [c for c in colors if not c.startswith("Size") and not c.startswith("Selected") and len(c) < 60]
    brand = guess_brand(user_label) or guess_brand(title) or None
    category = guess_category(user_label, title, sizes)

    superbuy_url = f"https://www.superbuy.com/en/page/buy/?url={source_url}"
    # If existing has a manual description/notes, preserve them
    description = existing.get("description") or title
    item_code = existing.get("item_code")

    data = {
        "user_label": user_label,
        "url": superbuy_url,
        "source_url": source_url.replace("%2F", "/").replace("%3F", "?").replace("%3D", "=").replace("%26", "&").replace("%3A", ":"),
        "title": title,
        "title_translated": title,
        "description": description,
        "price": raw.get("priceRmb"),
        "price_rmb": raw.get("priceRmb"),
        "price_usd": raw.get("priceUsd"),
        "sizing": ", ".join(sizes) if sizes else None,
        "sizes": sizes,
        "variants": colors,
        "seller_id": raw.get("sellerId"),
        "brand": brand,
        "item_code": item_code,
        "seller": existing.get("seller") or raw.get("shopName"),
        "seller_url": existing.get("seller_url") or raw.get("shopUrl"),
        "image_urls": (raw.get("gallery") or [])[:10],
        "detail_image_urls": (raw.get("detail") or [])[:10],
        "params": clean_params(raw.get("params") or {}),
        "source": platform,
        "category": category,
        "notes": existing.get("notes") or f"{len(raw.get('detail') or [])} detail images captured. Sizing chart not yet parsed.",
        "size_chart": existing.get("size_chart"),
        "needs_sizing_parse": (category in ("apparel-top", "apparel-bottom", "shoes")) and not existing.get("size_chart"),
    }
    out.write_text(json.dumps(data, ensure_ascii=False, indent=2))
    print(f"saved {slug} | brand={brand} | cat={category} | sizes={sizes} | g={len(data['image_urls'])} d={len(data['detail_image_urls'])}")

if __name__ == "__main__":
    main()
