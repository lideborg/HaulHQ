// Extractor for a Superbuy product page. Run via Playwright `page.evaluate`.
// Returns { sourceUrl, title, priceRmb, priceUsd, sizes, colors, gallery, detailImages, params, descText }
async function extractSuperbuy() {
  // Slow scroll to trigger lazy-load of description images
  const max = document.body.scrollHeight;
  for (let y = 0; y <= max; y += 600) {
    window.scrollTo(0, y);
    await new Promise(r => setTimeout(r, 200));
  }
  await new Promise(r => setTimeout(r, 1500));
  // Re-check height after lazy-load expanded the page
  const max2 = document.body.scrollHeight;
  if (max2 > max) {
    for (let y = max; y <= max2; y += 600) {
      window.scrollTo(0, y);
      await new Promise(r => setTimeout(r, 200));
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  window.scrollTo(0, 0);

  const sourceUrl = new URLSearchParams(location.search).get('url');
  const title = document.title.replace(/\s*-\s*Superbuy\s*$/, '').trim();

  const priceRmbRaw = document.querySelector('.detail-price-cn, [class*="price-cn"], [class*="Price-cn"], .pricecn')?.textContent
    || document.querySelector('[class*="price"]')?.textContent || '';
  const rmbM = priceRmbRaw.match(/[¥￥]\s*([\d,.]+)/);
  const usdM = priceRmbRaw.match(/\$\s*([\d,.]+)/);

  // Strip alicdn thumbnail size suffix to get full-size URL
  const stripSuffix = u => u
    .replace(/_\d+x\d+q\d+\.(jpg|png|webp|jpeg)(\?.*)?$/i, '')
    .replace(/_\d+x\d+\.(jpg|png|webp|jpeg)(\?.*)?$/i, '');

  // Extract seller ID from main hero image URL: alicdn.com/<x>/<seg>/<sellerId>/<file>
  const heroImg = document.querySelector('.preview-window img, .goods-img_preview img');
  const heroSrc = heroImg?.src || '';
  const sellerMatch = heroSrc.match(/alicdn\.com\/[^/]+\/[^/]+\/(\d+)\//);
  const sellerId = sellerMatch?.[1] || null;

  // Collect all alicdn images on page, dedup by stripped URL
  const seen = new Set();
  const all = [];
  for (const img of document.querySelectorAll('img')) {
    const src = img.src || img.dataset?.src;
    if (!src) continue;
    if (!/alicdn\.com|wd-cdn|imageweidian|wdimg|kkfileview|img1\.superbuy/.test(src)) continue;
    const full = stripSuffix(src);
    if (seen.has(full)) continue;
    seen.add(full);
    let parentCls = '';
    let p = img.parentElement;
    for (let i = 0; i < 5 && p && !parentCls; i++, p = p.parentElement) {
      if (typeof p.className === 'string' && p.className) parentCls = p.className;
    }
    all.push({ url: full, raw: src, w: img.naturalWidth || 0, h: img.naturalHeight || 0, parentCls });
  }

  // Gallery: same-seller alicdn images in `bao/uploaded` paths (not the description container)
  const gallery = [];
  const detailImages = [];
  for (const item of all) {
    const inDetail = /detail-goodsDetail|goods-detail_right|buy-detailContent|good-detail-info-container/i.test(item.parentCls);
    const matchSeller = sellerId && item.url.includes(`/${sellerId}/`);
    if (inDetail) {
      detailImages.push(item.url);
    } else if (matchSeller) {
      // gallery image: front, back, etc.
      gallery.push(item.url);
    }
  }
  // De-dup keeping first occurrence
  const ddGallery = Array.from(new Set(gallery));
  const ddDetail = Array.from(new Set(detailImages));

  // Always include the hero first if not already there
  if (heroSrc && sellerId) {
    const heroFull = stripSuffix(heroSrc);
    if (!ddGallery.includes(heroFull)) ddGallery.unshift(heroFull);
  }

  // Sizes & colors. Look in .specify, .detail-sku, etc.
  const sizes = [];
  const colors = [];
  // Find a row labeled Size / Color
  const rows = document.querySelectorAll('[class*="specify"], [class*="sku"], [class*="prop"]');
  // Heuristic: text content "Size\nXX\nXX..."
  const skuText = Array.from(document.querySelectorAll('.detail-sku, .detail-skuList, [class*="specify-row"]'))
    .map(e => e.textContent.trim()).join('\n');

  // Body text area for spec table
  const bodyText = document.body.innerText;
  const sizeBlock = bodyText.match(/Size\s*Selected:[^\n]*\n([\s\S]+?)Color\s*Selected/i);
  if (sizeBlock) {
    const tokens = sizeBlock[1].split(/[\n,，、]/).map(s => s.trim()).filter(Boolean);
    for (const t of tokens) if (!sizes.includes(t) && t.length < 20) sizes.push(t);
  }
  const colorBlock = bodyText.match(/Color\s*Selected:[^\n]*\n([\s\S]+?)(Shopping Assistant|Quantity|Image|Stock)/i);
  if (colorBlock) {
    const tokens = colorBlock[1].split(/[\n,，、]/).map(s => s.trim()).filter(Boolean);
    for (const t of tokens) if (!colors.includes(t) && t.length < 30) colors.push(t);
  }

  // Product Parameters table (key/value pairs in description)
  const params = {};
  const paramsBlock = bodyText.match(/Product Parameters\s*\n([\s\S]+?)(?:Product Details|After Sales Service|Disclaimer|Hot Topics|$)/);
  if (paramsBlock) {
    const lines = paramsBlock[1].split('\n').map(l => l.trim()).filter(Boolean);
    // pairs: key on one line, value on next
    for (let i = 0; i < lines.length - 1; i += 2) {
      const k = lines[i].replace(/[:：]$/, '');
      const v = lines[i + 1];
      if (k && v && k.length < 60 && v.length < 200) params[k] = v;
    }
  }

  // Description / "CEO tips" or "Product Details" paragraph
  const descMatch = bodyText.match(/(?:CEO tips|Product Details)\s*\n([\s\S]+?)(?:Product Parameters|Shopping Agent Notes|Disclaimer|$)/);
  const descText = descMatch ? descMatch[1].trim().slice(0, 3000) : '';

  return {
    sourceUrl,
    title,
    priceRmb: rmbM ? `¥${rmbM[1]}` : null,
    priceUsd: usdM ? `$${usdM[1]}` : null,
    sizes,
    colors,
    sellerId,
    gallery: ddGallery,
    detailImages: ddDetail,
    params,
    descText,
    debugAllCount: all.length,
  };
}
extractSuperbuy();
