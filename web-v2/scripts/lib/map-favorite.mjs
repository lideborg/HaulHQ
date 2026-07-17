export function parseCostCny(price) {
  if (!price) return null;
  const m = String(price).match(/[¥￥]\s*([\d,]+(?:\.\d+)?)/);
  return m ? parseFloat(m[1].replace(/,/g, "")) : null;
}

export function deriveSizes(fav) {
  if (fav.size_chart?.sizes?.length) return fav.size_chart.sizes.map(String);
  if (fav.target_size) return [String(fav.target_size)];
  return ["One Size"];
}

export function deriveSizeGuide(fav) {
  const c = fav.size_chart;
  if (!c?.sizes?.length || !c?.measurements) return null;
  const g = { unit: c.unit || "cm", sizes: c.sizes.map(String), measurements: c.measurements };
  if (c.note) g.note = c.note;
  return { unit: g.unit, note: g.note, sizes: g.sizes, measurements: g.measurements };
}

export function firstSentence(notes) {
  if (!notes) return null;
  const s = String(notes).split(/(?<=\.)\s+/)[0].trim();
  if (!s) return null;
  return s.length > 200 ? s.slice(0, 197) + "..." : s;
}

export function localImagePaths(fav) {
  return (fav.local_image_paths || []).filter((p) => !/size[-_]?chart/i.test(p));
}

export function mapFavorite(fav, fxCnyUsd, markup = 0.2) {
  const cost = parseCostCny(fav.price);
  return {
    brand: (fav.brand || "").replace(/\s*\(rep\)\s*$/i, "").trim() || null,
    title: fav.title || fav.user_label || "Untitled",
    description: firstSentence(fav.notes),
    category: fav.category ?? null,
    seller: fav.seller ?? null,
    source_link: fav.source_url || fav.yupoo_url || fav.url || null,
    source_platform: fav.source ?? null,
    cost_cny: cost,
    markup,
    price_usd: cost != null ? Math.round(cost * fxCnyUsd * (1 + markup) * 100) / 100 : null,
    size_options: deriveSizes(fav),
    size_guide: deriveSizeGuide(fav),
    admin_sizing_note: fav.sizing ?? null,
    published: true,
  };
}
