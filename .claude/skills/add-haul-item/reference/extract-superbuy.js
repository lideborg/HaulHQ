// Superbuy product-page extractor — paste into Chrome MCP javascript_tool
// (action: "javascript_exec") on a fully-loaded superbuy.com/page/buy/?url=... tab.
//
// Resolves the wrapped Taobao/Weidian/1688 listing, finds the seller ID,
// and returns seller-FILTERED gallery + detail image URLs. The size chart is
// almost always the first entry in `detail` — download and Read it.
//
// Wrapped in an async IIFE because top-level await fails in this REPL.

(async () => {
  // 1. Wait for Cloudflare + product hydration, then slow-scroll to lazy-load detail images.
  await new Promise((r) => setTimeout(r, 4000));
  const max = document.body.scrollHeight;
  for (let y = 0; y <= max; y += 800) {
    window.scrollTo(0, y);
    await new Promise((r) => setTimeout(r, 150));
  }
  window.scrollTo(0, 0);
  await new Promise((r) => setTimeout(r, 800));

  // 2. Strip Alibaba/Weidian size suffixes to get full-resolution originals.
  const stripSuffix = (u) =>
    u
      .replace(/_\d+x\d+q\d+\.(jpg|png|webp|jpeg)(\?.*)?$/i, "")
      .replace(/_\d+x\d+\.(jpg|png|webp|jpeg)(\?.*)?$/i, "")
      .replace(/\.webp(\?.*)?$/i, "");

  // 3. Resolved source URL + price.
  const srcLink =
    [...document.querySelectorAll("a")]
      .map((a) => a.href)
      .find((h) => /taobao\.com\/item|weidian\.com\/item|1688\.com/.test(h)) ||
    null;
  const price =
    (document.body.innerText.match(/CN\s*[￥¥]\s*([\d.]+)/) || [])[1] || null;
  const title = document.title.replace(/\s*-\s*Superbuy\s*$/i, "").trim();

  // 4. Hero seller ID — the long digit run shared by all real product images.
  const allImg = [...document.querySelectorAll("img")]
    .map((i) => i.src)
    .filter((s) => /alicdn\.com|geilicdn\.com/.test(s));
  const sellerId =
    allImg.map((s) => (s.match(/\/(\d{6,})\//) || [])[1]).find(Boolean) || null;

  // 5. Keep ONLY images belonging to this seller (kills recommended-product noise).
  const mine = [
    ...new Set(
      allImg
        .filter(
          (s) =>
            sellerId &&
            (s.includes("/" + sellerId + "/") || s.includes("-" + sellerId + "-")),
        )
        .map(stripSuffix),
    ),
  ];

  // 6. Split gallery vs detail by walking up ancestor class names.
  const classOf = (src) => {
    const key = src.split("/").pop().split(".")[0];
    const img = [...document.querySelectorAll("img")].find((i) =>
      i.src.includes(key),
    );
    if (!img) return "";
    let c = "",
      n = img;
    for (let i = 0; i < 7 && n; i++) {
      c += " " + (n.className || "");
      n = n.parentElement;
    }
    return c.toLowerCase();
  };
  const detail = mine.filter((s) => /detail/.test(classOf(s)));
  const gallery = mine.filter((s) => !/detail/.test(classOf(s)));

  return JSON.stringify(
    { title, srcLink, sellerId, price, gallery, detail },
    null,
    2,
  );
})();
