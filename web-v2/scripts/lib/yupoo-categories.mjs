// Extract (category id, title) pairs from a Yupoo /categories page. Yupoo
// renders anchors with single-quoted attributes; titles carry emoji, HTML
// entities, and censored brand spellings — decode but do not normalize here
// (normalization is the LLM's job in the crawl script).
const decode = (s) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();

export function parseCategories(html) {
  const out = [];
  const seen = new Set();
  for (const m of html.matchAll(/categories\/(\d+)[^>]*?title=['"]([^'"]+)['"]/g)) {
    const id = m[1];
    if (id === "0" || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, title: decode(m[2]) });
  }
  return out;
}
