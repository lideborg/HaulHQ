// Build the brand → Yupoo-seller-category index behind shop search fall-through.
// Fetches each seller's /albums page (Yupoo serves curl fine WITH browser-like
// headers — the 403 is UA-sniffing only), extracts every /categories/<id> link,
// normalizes seller slang to canonical brand names (LEM→Lemaire, Pra→Prada…),
// and replaces that seller's rows in seller_brand_links.
//
//   node scripts/index-yupoo-brands.mjs           # index all sellers
//   node scripts/index-yupoo-brands.mjs happywhale  # just one
import { loadEnv } from "./lib/env.mjs";
import { adminClient } from "./lib/storage.mjs";

const env = loadEnv(".env.local");
const sb = adminClient(env);

const SELLERS = [
  "happywhale", "cn--made", "loganhere", "718made", "mvt-shop01",
  "swaggymade", "charlesking77", "i795", "niuyue688", "yolo66", "fashionbroda",
  // r/QualityReps recommended sellers with validated Yupoos (2026-07-19 hunt;
  // most QR sellers are Weidian/WeChat-only and have none)
  "rmism", "atomu", "ashmade", "kj-made", "b197",
  // makemood — archive/designer specialist (Celine, Saint Laurent, Undercover,
  // Dior Homme, Junya Watanabe, Balenciaga, Chrome Hearts); 2026-07-20
  "makemood",
];

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

// Canonical brand ← the aliases/misspellings/censor-spellings sellers use.
// Unknown aliases fall through with brand = cleaned alias, so they stay
// searchable by the raw term.
const CANON = {
  "Lemaire": ["lem", "lemaire"],
  "Our Legacy": ["ol", "our legacy", "ourlegacy"],
  "The Row": ["row", "the row", "tr"],
  "Bottega Veneta": ["bv", "bottega", "bottega veneta", "botteca veneta"],
  "Saint Laurent": ["ysl", "saint laurent", "slp", "saint", "saint de paris"],
  "Prada": ["pra", "prad", "prada"],
  "Miu Miu": ["miu", "miumiu", "miu miu"],
  "Loewe": ["loe", "loew", "loewe", "lw"],
  "Maison Margiela": ["margiela", "maison margiela", "mmm"],
  "MM6 Maison Margiela": ["mm6"],
  "Gentle Monster": ["gm", "gentle", "gentle monster"],
  "Celine": ["celine", "celinee", "cel"],
  "Chanel": ["chanel", "chan-el", "chan--el", "chane"],
  "Balenciaga": ["blcg", "balenciaga", "balen"],
  "Enfants Riches Déprimés": ["erd", "enfants riches deprimes"],
  "Jil Sander": ["jil", "jil sander"],
  "Dries Van Noten": ["dvn", "dries", "dries van noten"],
  "Acne Studios": ["acne", "acne studios"],
  "Zegna": ["zegna"],
  "Jacques Marie Mage": ["jmm", "jacques marie mage"],
  "Jacquemus": ["jacq", "jacquemus"],
  "Louis Vuitton": ["lv", "louis vuitton"],
  "Hermès": ["hermes", "he*rmes", "herme"],
  "Gucci": ["gucci"],
  "Dior": ["dior"],
  "Fendi": ["fend", "fendi"],
  "Goyard": ["goyard"],
  "Versace": ["versace", "vercas", "versey", "versizace"],
  "Valentino": ["valentino", "valenentino", "valentin"],
  "Givenchy": ["gvc", "givenchy"],
  "Off-White": ["off white", "off-white", "ow"],
  "Tom Ford": ["tom ford", "tomford"],
  "Dolce & Gabbana": ["dolce gabbana", "dolce & gabbana", "dolce", "d&g", "dg"],
  "Chrome Hearts": ["chrome heart", "chrome hearts", "ch"],
  "New Balance": ["nb", "new balance"],
  "Arc'teryx": ["arc'teryx", "arc'tery", "arcteryx", "λrc'teryx"],
  "Rick Owens": ["ro", "rick owens", "rick", "rick oens"],
  "Raf Simons": ["raf", "raf simons"],
  "Comme des Garçons": ["cdg", "comme des garcons"],
  "Fear of God": ["fog", "fear of god", "essentials"],
  "The North Face": ["tnf", "north face", "the north face"],
  "C.P. Company": ["cp company", "c.p. company"],
  "Stone Island": ["stone island"],
  "Moncler": ["moncler"],
  "Loro Piana": ["lp", "loro piana"],
  "Brunello Cucinelli": ["brunello cucinelli", "bc"],
  "Hugo Boss": ["boss", "hugo boss"],
  "Alexander Wang": ["aw", "alexander wang"],
  "Y-3": ["y3", "y-3"],
  "Yohji Yamamoto": ["yohji", "yohji yamamoto"],
  "Junya Watanabe": ["junya", "junya watanabe"],
  "Undercover": ["undercover", "undercover 02", "non-undercover", "autonomous"],
  "Issey Miyake": ["issey", "issey miyake"],
  "Vetements": ["vtm", "vetements"],
  "Ami Paris": ["ami", "ami paris"],
  "A.P.C.": ["apc", "a.p.c."],
  "Jordan": ["aj", "jordan"],
  "Nike": ["nike"],
  "Adidas": ["adidas"],
  "Salomon": ["salomon"],
  "Asics": ["asics"],
  "Burberry": ["burberry"],
  "Cartier": ["cartier"],
  "Bvlgari": ["bvlgari"],
  "Tiffany": ["tiff", "tiffany"],
  "Jimmy Choo": ["jimmy", "jimmy choo"],
  "Linda Farrow": ["linda farrow"],
  "Mykita": ["mykita"],
  "Dita": ["dita"],
  "Thierry Lasry": ["thierry lasry"],
  "Oliver Peoples": ["olive peopless", "oliver peoples"],
  "Balmain": ["balmain"],
  "Palm Angels": ["palm angels"],
  "Ferragamo": ["ferragamo"],
  "Montblanc": ["montblanc", "mont blanc"],
  "Christian Louboutin": ["christian louboutin", "cl"],
  "Birkenstock": ["birkenstock"],
  "Tod's": ["tods", "tod's"],
  "Bally": ["bally"],
  "Dunhill": ["dunhill"],
  "Emporio Armani": ["emporio armani", "armani"],
  "Giuseppe Zanotti": ["giuseppe zanotti"],
  "Kiton": ["kiton"],
  "Stefano Ricci": ["stefano ricci"],
  "Zilli": ["zilli"],
  "Ecco": ["ecco"],
  "UGG": ["ugg"],
  "Maison Kitsuné": ["maison kitsune", "kitsune"],
  "Alaïa": ["alaia"],
  "Roger Vivier": ["roger vivier", "roger"],
  "Aquazzura": ["aquazzura"],
  "Manolo Blahnik": ["manolo blahnik", "manolo"],
  "Kapital": ["kapital"],
  "Visvim": ["visvim"],
  "Needles": ["needles"],
  "Human Made": ["human made"],
  "Bape": ["bape"],
  "Stüssy": ["stussy"],
  "Supreme": ["supreme"],
  "Palace": ["palace"],
  "Amiri": ["amiri"],
  "Gallery Dept": ["gallery dept"],
  "Chopard": ["chopard"],
  "Maybach": ["maybach"],
  "Auralee": ["auralee"],
  "Studio Nicholson": ["studio nicholson"],
  "Nanamica": ["nanamica"],
  "Roberto Cavalli": ["roberto cavalli"],
  "Billionaire": ["billionaire"],
  "Philipp Plein": ["philip plein", "philipp plein"],
};
const ALIAS = new Map();
for (const [brand, aliases] of Object.entries(CANON))
  for (const a of aliases) ALIAS.set(a, brand);

// Names that are product types / site chrome, not brands.
const SKIP =
  /^(about|contact|home|others?|extra|new|sale|hot|all|sunglasses|glasses|shoes|bags?|belts?|hats?|scarf|scarves|wallets?|socks|coat|suit|shorts?|t-?shirts?|vest|culottes|yoga mat|slippers?|high heels?|women'?s? shoes|men'?s? shoes|size ?charts?|how to (buy|order)|faq|payment|shipping)/i;

function cleanName(raw) {
  let s = raw.normalize("NFKC");
  s = s.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{2139}]/gu, ""); // emoji
  s = s.replace(/【[^】]*】/g, " "); // factory tags
  s = s.replace(/\((best|top|new|hot)[^)]*\)/gi, " ");
  s = s.replace(/[*_~`|]+/g, ""); // censor chars: loew* -> loew
  s = s.replace(/[一-鿿]+/g, " "); // CJK fragments: coat外套 -> coat
  return s.replace(/\s+/g, " ").trim();
}

function canonicalize(cleaned) {
  const key = cleaned.toLowerCase().replace(/\s+/g, " ").trim();
  if (ALIAS.has(key)) return ALIAS.get(key);
  // try without punctuation
  const bare = key.replace(/[^a-z0-9 ]/g, "");
  if (ALIAS.has(bare)) return ALIAS.get(bare);
  return null;
}

async function indexSeller(seller) {
  const base = `https://${seller}.x.yupoo.com`;
  let html;
  try {
    const r = await fetch(`${base}/albums`, { headers: HEADERS });
    if (!r.ok) return { seller, dead: true, note: `HTTP ${r.status}` };
    html = await r.text();
  } catch (e) {
    return { seller, dead: true, note: e.message };
  }
  if (/This Album Is Not Exist|Page Not Found/i.test(html) && !/categories\//.test(html))
    return { seller, dead: true, note: "not found page" };

  const rows = new Map(); // name(lower) -> row
  const seenUrls = new Set(); // unique(seller,url) in the DB — never emit dup URLs
  const re = /<a[^>]*href="([^"]*\/categories\/(\d+)[^"]*)"[^>]*>([\s\S]*?)<\/a>/g;
  let m;
  while ((m = re.exec(html))) {
    const text = m[3].replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
    if (!text) continue;
    const cleaned = cleanName(text);
    if (!/[A-Za-z]{2}/.test(cleaned)) continue;
    if (SKIP.test(cleaned)) continue;
    const brand = canonicalize(cleaned) ?? cleaned;
    const key = brand.toLowerCase();
    if (rows.has(key)) continue; // first link per brand per seller
    const url = (m[1].startsWith("http") ? m[1] : base + m[1]).split("&")[0];
    if (seenUrls.has(url)) continue; // two labels for one category page
    seenUrls.add(url);
    rows.set(key, {
      seller: `${seller} (Yupoo)`,
      brand,
      alias: cleaned.toLowerCase() === brand.toLowerCase() ? null : cleaned,
      url,
      active: true,
    });
  }
  const list = [...rows.values()];
  // A 200 that parsed to nothing (anti-bot interstitial, layout change) must
  // not wipe the seller's existing index.
  if (!list.length) return { seller, dead: false, n: 0, note: "0 parsed — kept existing rows" };

  await sb.from("seller_brand_links").delete().eq("seller", `${seller} (Yupoo)`);
  for (let i = 0; i < list.length; i += 200) {
    const { error } = await sb.from("seller_brand_links").insert(list.slice(i, i + 200));
    if (error) return { seller, dead: false, note: `insert err: ${error.message}`, n: 0 };
  }
  const known = list.filter((r) => r.alias !== null || ALIAS.has(r.brand.toLowerCase())).length;
  return { seller, dead: false, n: list.length, known };
}

const only = process.argv[2];
for (const seller of only ? [only] : SELLERS) {
  const r = await indexSeller(seller);
  console.log(
    r.dead
      ? `✗ ${seller.padEnd(15)} DEAD (${r.note})`
      : `✓ ${seller.padEnd(15)} ${String(r.n).padStart(4)} brand links${r.note ? ` (${r.note})` : ""}`,
  );
}
console.log("done.");
