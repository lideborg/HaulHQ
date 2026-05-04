#!/usr/bin/env python3
"""Enrich item JSONs with source, seller, brand, category, item_code, status."""
import json
import re
from datetime import date
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent.parent
YUPOO = ROOT / "data" / "yupoo"

BRAND_MAP = {
    "TR": "The Row", "Row": "The Row", "ROW": "The Row",
    "ERD": "Enfants Riches Déprimés",
    "LEM": "Lemaire", "LM": "Lemaire", "Lem": "Lemaire",
    "Prada": "Prada", "Gucci": "Gucci", "Cartier": "Cartier",
    "BLCG": "Balenciaga", "Givenchy": "Givenchy", "Yohji": "Yohji Yamamoto",
    "Bolo": "Unknown", "Gats": "Unknown", "Bolo": "Unknown",
}

CATEGORY_KEYWORDS = [
    (r"\b(glasses|sunglasses|frame|optic)\b", "eyewear"),
    (r"\b(bag|tote|toiletry|drawstring bag)\b", "bag"),
    (r"\b(shoes|sneaker|boot)\b", "shoes"),
    (r"\b(pant|trouser|short|jean|drawstring)\b", "apparel-bottom"),
    (r"\b(shirt|tee|t-shirt|sweater|knit|jacket|blazer|cordoy|coat|suite)\b", "apparel-top"),
    (r"\b(belt|tie|bolo)\b", "accessory"),
]

ITEM_CODE_RE = re.compile(r"\b([A-Z]{1,3}\d{3,6}|Y\d{4,6}|OF\d{3,6}|AF\d{3,6})\b")


def infer_brand(label: str, title: str) -> str:
    text = f"{label} {title}"
    for key, brand in sorted(BRAND_MAP.items(), key=lambda x: -len(x[0])):
        if re.search(rf"\b{re.escape(key)}\b", text, re.I if key.lower() == key else 0):
            if BRAND_MAP[key] != "Unknown":
                return brand
    return ""


def infer_category(label: str, title: str) -> str:
    text = f"{label} {title}".lower()
    for pat, cat in CATEGORY_KEYWORDS:
        if re.search(pat, text):
            return cat
    return ""


def infer_item_code(label: str, title: str) -> str:
    for s in (title, label):
        m = ITEM_CODE_RE.search(s or "")
        if m:
            return m.group(1)
    return ""


def infer_seller(url: str) -> str:
    host = urlparse(url).hostname or ""
    # happywhale.x.yupoo.com → happywhale
    parts = host.split(".")
    if len(parts) >= 3 and parts[1] == "x":
        return parts[0]
    return host


def main():
    today = date.today().isoformat()
    files = sorted(p for p in YUPOO.glob("*.json") if p.name != "_index.json")
    for jf in files:
        d = json.loads(jf.read_text())
        title = d.get("title_translated") or d.get("title") or ""
        d.setdefault("source", "yupoo")
        d.setdefault("seller", infer_seller(d.get("url", "")))
        d.setdefault("brand", infer_brand(d.get("user_label", ""), title))
        d.setdefault("category", infer_category(d.get("user_label", ""), title))
        d.setdefault("item_code", infer_item_code(d.get("user_label", ""), title))
        d.setdefault("status", "wishlist")
        d.setdefault("date_added", today)
        d.setdefault("personal_notes", "")
        jf.write_text(json.dumps(d, ensure_ascii=False, indent=2))
        print(f"✓ {jf.stem}: {d['brand']} / {d['category']} / {d['item_code']}")

    # Rebuild index with enriched fields
    idx_path = YUPOO / "_index.json"
    idx = json.loads(idx_path.read_text())
    for entry in idx["entries"]:
        d = json.loads((YUPOO / entry["file"]).read_text())
        entry["brand"] = d["brand"]
        entry["category"] = d["category"]
        entry["item_code"] = d["item_code"]
        entry["status"] = d["status"]
        entry["seller"] = d["seller"]
        entry["source"] = d["source"]
    idx_path.write_text(json.dumps(idx, ensure_ascii=False, indent=2))
    print("✓ _index.json updated")


if __name__ == "__main__":
    main()
