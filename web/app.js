const DATA_DIRS = ["../data/yupoo/", "../data/superbuy/"];
const DATA = DATA_DIRS[0]; // legacy default for callers that haven't been updated
const STRIP_SLOTS = 9; // 8 thumbs + 1 "+" button
const CNY_PER_USD = 6.83; // May 2026 reference rate

function formatPrice(p) {
  if (!p) return "—";
  const m = String(p).match(/[¥￥]\s*(\d+(?:\.\d+)?)/);
  if (m) {
    const cny = parseFloat(m[1]);
    const usd = Math.round(cny / CNY_PER_USD);
    return `${p}  ($${usd})`;
  }
  return p;
}

const state = {
  items: [],
  filter: "all",
  ownerFilter: "all",   // "all" | "hampus" | "jan" | "shared" | "wishlist"
  viewMode: localStorage.getItem("haul.viewMode") || "grid",   // "grid" | "list"
  sort: localStorage.getItem("haul.sort") || "default",        // "default" | "price-desc" | "price-asc"
  showOos: localStorage.getItem("haul.showOos") === "1",       // hide out-of-stock by default
  view: "catalog",      // "catalog" | "wishlist" | "notes"
  wishlist: new Set(JSON.parse(localStorage.getItem("haul.wishlist") || "[]")),
};

function itemKey(item) {
  return (item._dir || "") + (item.user_label || "") + "|" + (item.url || "");
}
function isWished(item) { return state.wishlist.has(itemKey(item)); }
function toggleWish(item) {
  const k = itemKey(item);
  if (state.wishlist.has(k)) state.wishlist.delete(k); else state.wishlist.add(k);
  localStorage.setItem("haul.wishlist", JSON.stringify([...state.wishlist]));
  updateWishlistCount();
}
function updateWishlistCount() {
  const el = document.getElementById("wishlist-count");
  if (el) el.textContent = state.wishlist.size > 0 ? state.wishlist.size : "";
}

async function loadJSON(path) {
  const res = await fetch(DATA + path);
  return res.json();
}

function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") e.className = v;
    else if (k === "html") e.innerHTML = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  for (const c of children) {
    if (c == null) continue;
    e.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return e;
}

function imagesOf(item) {
  const base = item._dir || DATA;
  if (item.local_image_paths && item.local_image_paths.length) {
    return item.local_image_paths.map(p => base + p);
  }
  return item.image_urls || [];
}

function categoryLabel(c) {
  return ({
    "apparel-top": "Apparel",
    "apparel-bottom": "Apparel",
    "eyewear": "Eyewear",
    "bag": "Bag",
    "shoes": "Shoes",
    "accessory": "Accessory",
  })[c] || (c || "All");
}

async function init() {
  const all = [];
  for (const dir of DATA_DIRS) {
    try {
      const idx = await fetch(dir + "_index.json").then(r => r.json());
      const loaded = await Promise.all(
        idx.entries.map(async e => {
          const item = await fetch(dir + e.file).then(r => r.json());
          item._dir = dir;
          return item;
        })
      );
      all.push(...loaded);
    } catch (err) {
      console.warn("Skipping data dir", dir, err);
    }
  }
  state.items = all;
  await loadShippingData().catch(err => console.warn("shipping data load failed", err));
  renderFilters();
  renderOwnerFilters();
  setupViewToggle();
  setupSortControl();
  rerender();
  setupTabs();
  setupBulkActions();
  updateWishlistCount();
}

function setupSortControl() {
  const sel = document.getElementById("sort-by");
  if (sel) {
    sel.value = state.sort;
    sel.addEventListener("change", () => {
      state.sort = sel.value;
      localStorage.setItem("haul.sort", state.sort);
      rerender();
    });
  }
  const oosBox = document.getElementById("show-oos");
  if (oosBox) {
    oosBox.checked = state.showOos;
    oosBox.addEventListener("change", () => {
      state.showOos = oosBox.checked;
      localStorage.setItem("haul.showOos", state.showOos ? "1" : "0");
      rerender();
    });
    const cnt = document.getElementById("oos-count");
    const n = state.items.filter(i => i.out_of_stock || i.skipped).length;
    if (cnt) cnt.textContent = n ? ` (${n})` : "";
  }
}

function setupViewToggle() {
  const wrap = document.getElementById("view-toggle");
  if (!wrap) return;
  wrap.querySelectorAll("button").forEach(b => {
    if (b.dataset.mode === state.viewMode) b.classList.add("active");
    else b.classList.remove("active");
    b.addEventListener("click", () => {
      state.viewMode = b.dataset.mode;
      localStorage.setItem("haul.viewMode", state.viewMode);
      wrap.querySelectorAll("button").forEach(x => x.classList.toggle("active", x.dataset.mode === state.viewMode));
      rerender();
    });
  });
}

function renderOwnerFilters() {
  const nav = document.getElementById("owner-filters");
  if (!nav) return;
  nav.innerHTML = "";
  const counts = {all: 0, hampus: 0, jan: 0, shared: 0};
  for (const it of state.items) {
    const o = it.owners || [];
    counts.all++;
    if (o.length > 1) counts.shared++;
    if (o.includes("hampus")) counts.hampus++;
    if (o.includes("jan")) counts.jan++;
  }
  const opts = [
    ["all", `All (${counts.all})`],
    ["hampus", `Hampus (${counts.hampus})`],
    ["jan", `Jan (${counts.jan})`],
    ["shared", `Shared (${counts.shared})`],
  ];
  for (const [v, lbl] of opts) {
    const b = el("button", {
      onclick: () => { state.ownerFilter = v; renderOwnerFilters(); rerender(); }
    }, lbl);
    if (state.ownerFilter === v) b.classList.add("active");
    nav.appendChild(b);
  }
}

function rerender() {
  if (state.view === "notes") return;
  const inWishlistView = state.view === "wishlist";
  document.getElementById("grid").classList.toggle("hidden", state.viewMode !== "grid");
  document.getElementById("list").classList.toggle("hidden", state.viewMode !== "list");
  document.getElementById("compact").classList.toggle("hidden", state.viewMode !== "compact");
  if (state.viewMode === "grid") renderGrid(inWishlistView);
  else if (state.viewMode === "list") renderList(inWishlistView);
  else renderCompact(inWishlistView);
}

function setupBulkActions() {
  const sa = document.getElementById("select-all");
  const cl = document.getElementById("clear-selection");
  if (sa) sa.addEventListener("click", () => {
    const items = visibleItems(state.view === "wishlist");
    for (const it of items) state.wishlist.add(itemKey(it));
    localStorage.setItem("haul.wishlist", JSON.stringify([...state.wishlist]));
    updateWishlistCount();
    rerender();
  });
  if (cl) cl.addEventListener("click", () => {
    const items = visibleItems(state.view === "wishlist");
    for (const it of items) state.wishlist.delete(itemKey(it));
    localStorage.setItem("haul.wishlist", JSON.stringify([...state.wishlist]));
    updateWishlistCount();
    rerender();
  });
  const ex = document.getElementById("export-wishlist");
  if (ex) ex.addEventListener("click", () => {
    const data = {
      exported: new Date().toISOString(),
      count: state.wishlist.size,
      keys: [...state.wishlist],
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `haul-wishlist-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });
  const im = document.getElementById("import-wishlist");
  const imIn = document.getElementById("import-wishlist-input");
  if (im && imIn) {
    im.addEventListener("click", () => imIn.click());
    imIn.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        const incoming = data.keys || data;
        if (!Array.isArray(incoming)) throw new Error("invalid format");
        const merge = confirm(`Import ${incoming.length} favorites?\n\nOK = merge with current ${state.wishlist.size}\nCancel = replace current with imported`);
        if (!merge) state.wishlist.clear();
        for (const k of incoming) state.wishlist.add(k);
        localStorage.setItem("haul.wishlist", JSON.stringify([...state.wishlist]));
        updateWishlistCount();
        rerender();
      } catch (err) {
        alert("Could not import: " + err.message);
      }
      imIn.value = "";
    });
  }
}

function setupTabs() {
  document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const view = btn.dataset.view;
      state.view = view;
      const isCatalogLike = view === "catalog" || view === "wishlist";
      document.getElementById("notes").classList.toggle("hidden", view !== "notes");
      document.getElementById("filters").style.display = isCatalogLike ? "" : "none";
      const ownersNav = document.getElementById("owner-filters"); if (ownersNav) ownersNav.style.display = isCatalogLike ? "" : "none";
      const vt = document.getElementById("view-toggle"); if (vt) vt.style.display = isCatalogLike ? "" : "none";
      if (view === "notes") {
        document.getElementById("grid").classList.add("hidden");
        document.getElementById("list").classList.add("hidden");
        if (!state.notesRendered) { renderNotes(); state.notesRendered = true; }
      } else {
        rerender();
      }
    });
  });
}

async function renderNotes() {
  const host = document.getElementById("notes");
  host.innerHTML = "";

  // Sellers
  const sellersData = await fetch("../data/notes/sellers.json").then(r => r.json());
  const sellersSection = el("section");
  sellersSection.appendChild(el("h2", {}, "Sellers"));
  const grid = el("div", { class: "seller-grid" });
  for (const s of sellersData.sellers) {
    const meta = el("div", { class: "seller-meta" });
    const linkUrl = s.yupoo || s.url;
    if (linkUrl) {
      const platform = /yupoo\.com/.test(linkUrl) ? "Yupoo"
        : /weidian\.com/.test(linkUrl) ? "Weidian"
        : /taobao\.com/.test(linkUrl) ? "Taobao"
        : /1688\.com/.test(linkUrl) ? "1688"
        : "Shop";
      meta.appendChild(el("span", {}, platform));
      meta.appendChild(el("a", { href: linkUrl, target: "_blank", rel: "noopener" }, linkUrl.replace(/^https?:\/\//, "")));
    }
    for (const [k, v] of Object.entries(s.contact || {})) {
      if (!v) continue;
      meta.appendChild(el("span", {}, k));
      meta.appendChild(el("span", {}, v));
    }
    if (s.researched) {
      meta.appendChild(el("span", {}, "Researched"));
      meta.appendChild(el("span", {}, s.researched));
    }
    const card = el("div", { class: "seller-card" },
      el("h3", {}, s.name),
      el("span", { class: `verdict ${s.verdict}` }, s.verdict.replace(/-/g, " ")),
      s.specialty ? el("p", { class: "specialty" }, s.specialty) : null,
      el("p", { class: "seller-notes" }, s.notes),
      meta,
    );
    grid.appendChild(card);
  }
  sellersSection.appendChild(grid);
  host.appendChild(sellersSection);

  // Glossary
  const glossary = await fetch("../data/notes/glossary.json").then(r => r.json());
  const glossarySection = el("section");
  glossarySection.appendChild(el("h2", {}, "Glossary"));

  const search = el("input", {
    type: "text",
    class: "glossary-search",
    placeholder: "Search abbreviations or terms…",
  });
  const abbrTable = el("table", { class: "glossary-table" });
  const termTable = el("table", { class: "glossary-table" });

  function renderGlossary(query) {
    const q = (query || "").toLowerCase().trim();
    abbrTable.innerHTML = "<thead><tr><th>Abbr</th><th>Brand</th><th>Notes</th></tr></thead>";
    const ab = el("tbody");
    for (const a of glossary.abbreviations) {
      const hay = `${a.abbr} ${a.brand} ${a.notes || ""}`.toLowerCase();
      if (q && !hay.includes(q)) continue;
      ab.appendChild(el("tr", {},
        el("td", { class: "abbr-cell" }, a.abbr),
        el("td", {}, a.brand),
        el("td", { class: "notes-cell" }, a.notes || "")
      ));
    }
    abbrTable.appendChild(ab);

    termTable.innerHTML = "<thead><tr><th>Term</th><th>Meaning</th></tr></thead>";
    const tb = el("tbody");
    for (const t of glossary.terminology) {
      const hay = `${t.term} ${t.meaning}`.toLowerCase();
      if (q && !hay.includes(q)) continue;
      tb.appendChild(el("tr", {},
        el("td", { class: "abbr-cell" }, t.term),
        el("td", {}, t.meaning)
      ));
    }
    termTable.appendChild(tb);
  }
  search.addEventListener("input", () => renderGlossary(search.value));
  renderGlossary("");

  glossarySection.appendChild(search);
  glossarySection.appendChild(el("h3", { class: "glossary-h3" }, "Brand abbreviations"));
  glossarySection.appendChild(abbrTable);
  glossarySection.appendChild(el("h3", { class: "glossary-h3" }, "Terminology"));
  glossarySection.appendChild(termTable);
  host.appendChild(glossarySection);

  // Guides
  const guidesIdx = await fetch("../data/notes/_index.json").then(r => r.json());
  const guidesSection = el("section");
  guidesSection.appendChild(el("h2", {}, "Guides"));
  const guidesWrap = el("div", { class: "guides" });
  for (const g of guidesIdx.guides) {
    const row = el("details", { class: "guide-row" },
      el("summary", {}, g.title)
    );
    const body = el("div", { class: "guide-body" });
    row.appendChild(body);
    row.addEventListener("toggle", async () => {
      if (row.open && !body.dataset.loaded) {
        const md_text = await fetch(`../data/notes/${g.file}`).then(r => r.text());
        body.innerHTML = window.md(md_text);
        body.dataset.loaded = "1";
      }
    });
    guidesWrap.appendChild(row);
  }
  guidesSection.appendChild(guidesWrap);
  host.appendChild(guidesSection);
}

function renderFilters() {
  const cats = ["all", ...new Set(state.items.map(i => i.category).filter(Boolean))];
  const nav = document.getElementById("filters");
  nav.innerHTML = "";
  // collapse the two apparel sub-cats into "Apparel" tab
  const seen = new Set();
  for (const c of cats) {
    const lbl = c === "all" ? "All" : categoryLabel(c);
    if (seen.has(lbl)) continue;
    seen.add(lbl);
    const btn = el("button", {
      onclick: () => { state.filter = c; renderFilters(); rerender(); }
    }, lbl);
    if (state.filter === c || (state.filter === "all" && c === "all")) btn.classList.add("active");
    nav.appendChild(btn);
  }
}

function passesFilter(item) {
  if (state.filter === "all") return true;
  const target = categoryLabel(state.filter);
  return categoryLabel(item.category) === target;
}

function passesOwner(item) {
  const o = item.owners || [];
  if (state.ownerFilter === "all") return true;
  if (state.ownerFilter === "hampus") return o.includes("hampus");
  if (state.ownerFilter === "jan") return o.includes("jan");
  if (state.ownerFilter === "shared") return o.length > 1;
  return true;
}

function visibleItems(wishlistOnly) {
  const items = state.items.filter(it => {
    if (wishlistOnly && !isWished(it)) return false;
    if (it.out_of_stock && !state.showOos && !isWished(it)) return false;
    if (it.skipped && !state.showOos && !isWished(it)) return false;
    return passesFilter(it) && passesOwner(it);
  });
  if (state.sort === "price-desc") {
    return [...items].sort((a, b) => priceCny(b) - priceCny(a));
  }
  if (state.sort === "price-asc") {
    // items with no price (0) sink to the bottom even on ascending sort
    return [...items].sort((a, b) => {
      const pa = priceCny(a), pb = priceCny(b);
      if (pa === 0 && pb === 0) return 0;
      if (pa === 0) return 1;
      if (pb === 0) return -1;
      return pa - pb;
    });
  }
  return items;
}

function renderGrid(wishlistOnly = false) {
  const grid = document.getElementById("grid");
  grid.innerHTML = "";
  const items = visibleItems(wishlistOnly);
  for (const item of items) {
    grid.appendChild(renderCard(item));
  }
  if (wishlistOnly) {
    grid.appendChild(buildHaulFooter());
  }
}

function renderList(wishlistOnly = false) {
  const list = document.getElementById("list");
  list.innerHTML = "";
  const items = visibleItems(wishlistOnly);
  for (const item of items) {
    list.appendChild(renderRow(item));
  }
  if (items.length || wishlistOnly) {
    list.appendChild(wishlistOnly ? buildHaulFooter() : buildFooter(items, wishlistOnly));
  } else {
    list.appendChild(el("div", { class: "list-empty" }, "No items match the current filter."));
  }
}

function priceCny(item) {
  const m = String(item.price || "").match(/[¥￥]\s*(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : 0;
}

function buildFooter(items, isHaul) {
  // Group by primary owner
  const byOwner = { hampus: [], jan: [], shared: [], unknown: [] };
  for (const it of items) {
    const o = it.owners || [];
    if (o.length > 1) byOwner.shared.push(it);
    else if (o.includes("hampus")) byOwner.hampus.push(it);
    else if (o.includes("jan")) byOwner.jan.push(it);
    else byOwner.unknown.push(it);
  }
  const sumOf = arr => arr.reduce((s, it) => s + priceCny(it), 0);
  const fmt = cny => `¥${cny.toFixed(2)}  ($${Math.round(cny / CNY_PER_USD)})`;
  const totalCny = sumOf(items);

  const lines = el("div", { class: "footer-lines" });
  if (byOwner.hampus.length) lines.appendChild(el("div", { class: "footer-line" },
    el("span", { class: "footer-owner hampus" }, `Hampus  ·  ${byOwner.hampus.length} items`),
    el("span", { class: "footer-amount" }, fmt(sumOf(byOwner.hampus))),
  ));
  if (byOwner.jan.length) lines.appendChild(el("div", { class: "footer-line" },
    el("span", { class: "footer-owner jan" }, `Jan  ·  ${byOwner.jan.length} items`),
    el("span", { class: "footer-amount" }, fmt(sumOf(byOwner.jan))),
  ));
  if (byOwner.shared.length) lines.appendChild(el("div", { class: "footer-line" },
    el("span", { class: "footer-owner" }, `Shared (Hampus + Jan)  ·  ${byOwner.shared.length} items`),
    el("span", { class: "footer-amount" }, fmt(sumOf(byOwner.shared))),
  ));

  const total = el("div", { class: "footer-total" },
    el("span", {}, `Total  ·  ${items.length} items`),
    el("span", { class: "footer-amount big" }, fmt(totalCny)),
  );

  const actions = el("div", { class: "footer-actions" });
  if (isHaul) {
    actions.appendChild(el("button", {
      class: "btn primary",
      onclick: (e) => { e.stopPropagation(); copyHaulSnippet(items, byOwner, totalCny); },
    },
      el("span", { html: '<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M11 1H4a2 2 0 0 0-2 2v8h2V3h7zm3 3H7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 10H7V6h7z"/></svg>' }),
      "Copy haul as text",
    ));
  }

  const footerEl = el("div", { class: "list-footer haul-footer" }, lines, total, actions);
  if (isHaul && typeof renderShippingPanel === "function") {
    try { footerEl.appendChild(renderShippingPanel(items)); } catch (e) { console.warn(e); }
  }
  return footerEl;
}

// Build the footer using the FULL wishlist (ignoring category/owner filters).
// Used in Haul tab so totals and copy reflect everything you've picked.
function buildHaulFooter() {
  const allWished = state.items.filter(it => isWished(it));
  return buildFooter(allWished, true);
}

function copyHaulSnippet(items, byOwner, totalCny) {
  const fmt = cny => `¥${cny.toFixed(2)} ($${Math.round(cny / CNY_PER_USD)})`;
  const sumOf = arr => arr.reduce((s, it) => s + priceCny(it), 0);
  const lineFor = it => {
    const code = it.item_code ? `#${it.item_code}` : "";
    const variant = it.target_variant ? ` (${it.target_variant})` : "";
    const price = it.price ? `  —  ${it.price}` : "";
    const seller = it.seller ? `  ·  ${it.seller}` : "";
    const oos = it.out_of_stock ? "  [OUT OF STOCK]" : "";
    const link = it.url || "";
    return `- ${it.user_label}${variant} ${code}${price}${seller}${oos}\n  ${link}`;
  };

  const dateStr = new Date().toISOString().slice(0, 10);
  const sections = [];
  sections.push(`# HAUL — ${dateStr}`, "");
  if (byOwner.hampus.length) {
    sections.push(`## Hampus  ·  ${byOwner.hampus.length} items  ·  ${fmt(sumOf(byOwner.hampus))}`, "");
    for (const it of byOwner.hampus) sections.push(lineFor(it));
    sections.push("");
  }
  if (byOwner.jan.length) {
    sections.push(`## Jan  ·  ${byOwner.jan.length} items  ·  ${fmt(sumOf(byOwner.jan))}`, "");
    for (const it of byOwner.jan) sections.push(lineFor(it));
    sections.push("");
  }
  if (byOwner.shared.length) {
    sections.push(`## Shared  ·  ${byOwner.shared.length} items  ·  ${fmt(sumOf(byOwner.shared))}`, "");
    for (const it of byOwner.shared) sections.push(lineFor(it));
    sections.push("");
  }
  sections.push(`## Total  ·  ${items.length} items  ·  ${fmt(totalCny)}`);

  const text = sections.join("\n");
  const finish = (ok) => {
    const note = el("div", { class: "copy-toast" + (ok ? "" : " err") }, ok ? "Copied to clipboard ✓" : "Copy failed — printed to console");
    document.body.appendChild(note);
    setTimeout(() => note.remove(), 2000);
    if (!ok) console.log(text);
  };
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => finish(true)).catch(() => finish(false));
  } else {
    finish(false);
  }
}

function renderCompact(wishlistOnly = false) {
  const grid = document.getElementById("compact");
  grid.innerHTML = "";
  const items = visibleItems(wishlistOnly);
  for (const item of items) {
    grid.appendChild(renderCompactCard(item));
  }
  if (wishlistOnly) {
    // Haul tab: always use the full wishlist regardless of filters.
    grid.appendChild(buildHaulFooter());
  } else if (items.length) {
    // Catalog: footer summarizes only the SELECTED ones from the visible set.
    const summarized = items.filter(it => isWished(it));
    if (summarized.length) {
      grid.appendChild(buildFooter(summarized, true));
    } else {
      grid.appendChild(el("div", { class: "compact-hint list-empty" }, "Tap tiles to select. The total will appear here as you pick."));
    }
  } else {
    grid.appendChild(el("div", { class: "list-empty" }, "No items match the current filter."));
  }
}

function renderCompactCard(item) {
  const imgs = imagesOf(item);
  const wished = isWished(item);
  const tile = el("div", {
    class: "compact-tile" + (wished ? " selected" : ""),
    title: `${item.user_label} — ${formatPrice(item.price)}`,
    onclick: (e) => {
      // shift+click opens modal; plain click toggles selection
      if (e.shiftKey) { openModal(item); return; }
      toggleWish(item);
      tile.classList.toggle("selected");
      if (state.view === "wishlist") { rerender(); return; }
      // update footer total without re-rendering all tiles
      const f = document.querySelector(".compact-footer");
      if (f) renderCompact(state.view === "wishlist");
    },
  },
    el("img", { src: imgs[0] || "", loading: "lazy", alt: item.user_label, class: "compact-thumb" }),
    el("div", { class: "compact-check" }, "✓"),
    el("div", { class: "compact-meta" },
      el("div", { class: "compact-label" }, item.user_label),
      el("div", { class: "compact-price" }, formatPrice(item.price)),
    ),
  );
  // info button (small ⓘ in corner) opens modal without selecting
  const info = el("button", {
    class: "compact-info",
    "aria-label": "Open detail",
    onclick: (e) => { e.stopPropagation(); openModal(item); },
  }, "ⓘ");
  tile.appendChild(info);
  return tile;
}

function renderRow(item) {
  const imgs = imagesOf(item);
  const thumbSrc = imgs[0] || "";
  const wished = isWished(item);
  const owners = (item.owners || []).join(", ");
  const variant = item.target_variant ? ` · ${item.target_variant}` : "";
  const sizing = item.sizing ? ` · ${item.sizing}` : "";
  const status = [];
  if (item.out_of_stock) status.push(el("span", { class: "badge bad" }, "Out of stock"));
  if (item.skipped) status.push(el("span", { class: "badge skipped" }, "Skipped"));
  if (item.locked) status.push(el("span", { class: "badge bad" }, "Locked album"));
  if (item.requires_contact) status.push(el("span", { class: "badge contact" }, "Contact seller"));
  if (item.has_size_chart || item.size_chart) status.push(el("span", { class: "badge ok" }, "Size chart"));

  const star = el("button", {
    class: "wish-btn" + (wished ? " on" : ""),
    "aria-label": wished ? "Remove from wishlist" : "Add to wishlist",
    onclick: (e) => {
      e.stopPropagation();
      toggleWish(item);
      star.classList.toggle("on");
      if (state.view === "wishlist") rerender();
    },
  }, wished ? "★" : "☆");

  const row = el("div", { class: "list-row", onclick: () => openModal(item) },
    el("img", { src: thumbSrc, loading: "lazy", alt: item.user_label, class: "list-thumb" }),
    el("div", { class: "list-main" },
      el("div", { class: "list-title-row" },
        el("span", { class: "list-brand" }, item.brand || ""),
        el("span", { class: "list-owners" }, owners),
      ),
      el("div", { class: "list-label" }, item.user_label + variant),
      el("div", { class: "list-sub" }, (item.title_translated || item.title || "").slice(0, 110) + sizing),
      el("div", { class: "list-status" }, ...status),
    ),
    el("div", { class: "list-price" }, formatPrice(item.price)),
    star,
  );
  return row;
}

function renderCard(item) {
  const imgs = imagesOf(item);
  const heroImg = el("img", { src: imgs[0], loading: "lazy", alt: item.user_label });
  const heroWrap = el("div", { class: "hero-wrap", onclick: () => openModal(item) }, heroImg);

  const thumbCount = STRIP_SLOTS - 1; // last slot is "+"
  const stripImgs = imgs.slice(0, thumbCount);
  const strip = el("div", { class: "strip" });
  stripImgs.forEach((url, i) => {
    const t = el("img", {
      src: url,
      loading: "lazy",
      onclick: (e) => {
        e.stopPropagation();
        heroImg.src = url;
        strip.querySelectorAll(".active").forEach(x => x.classList.remove("active"));
        t.classList.add("active");
      },
    });
    if (i === 0) t.classList.add("active");
    strip.appendChild(t);
  });
  // pad empty slots so layout stays even when fewer than 8 images
  for (let i = stripImgs.length; i < thumbCount; i++) {
    strip.appendChild(el("div", { class: "slot empty" }));
  }
  // "+" button as 9th slot — opens the lightbox
  const more = imgs.length > thumbCount ? `+${imgs.length - thumbCount}` : "+";
  strip.appendChild(el("button", {
    class: "slot plus",
    onclick: (e) => { e.stopPropagation(); openModal(item); },
    "aria-label": "Open lightbox",
  }, more));

  const star = el("button", {
    class: "wish-btn card-wish" + (isWished(item) ? " on" : ""),
    "aria-label": isWished(item) ? "Remove from wishlist" : "Add to wishlist",
    onclick: (e) => {
      e.stopPropagation();
      toggleWish(item);
      star.classList.toggle("on");
      star.textContent = star.classList.contains("on") ? "★" : "☆";
      if (state.view === "wishlist") rerender();
    },
  }, isWished(item) ? "★" : "☆");

  const card = el("div", { class: "card" },
    heroWrap,
    star,
    strip,
    el("div", { class: "body" },
      item.brand ? el("p", { class: "brand" }, item.brand) : null,
      el("p", { class: "label" }, item.user_label),
      el("p", { class: "title" }, item.title_translated || item.title || ""),
      el("p", { class: "price" }, formatPrice(item.price)),
    )
  );
  return card;
}

function openModal(item) {
  const modal = document.getElementById("modal");
  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";

  const imgs = imagesOf(item);
  const hero = document.getElementById("hero-img");
  hero.src = imgs[0] || "";

  document.getElementById("m-brand").textContent = item.brand || "";
  document.getElementById("m-title").textContent = item.user_label;
  document.getElementById("m-translated").textContent = item.title_translated || "";
  document.getElementById("m-price").textContent = formatPrice(item.price);
  document.getElementById("m-desc").textContent = item.description || "";
  document.getElementById("m-link").href = item.url;
  renderSizeChart(item);

  const dl = document.getElementById("m-dl");
  dl.innerHTML = "";
  const rows = [
    ["Item code", item.item_code],
    ["Sizing", item.sizing],
    ["Variants", (item.variants || []).join(", ")],
    ["Source", item.source],
    ["Seller", item.seller],
    ["Notes", item.notes],
  ];
  for (const [k, v] of rows) {
    if (!v) continue;
    dl.appendChild(el("dt", {}, k));
    dl.appendChild(el("dd", {}, v));
  }

  const thumbs = document.getElementById("m-thumbs");
  thumbs.innerHTML = "";
  for (const url of imgs) {
    thumbs.appendChild(el("img", {
      src: url, loading: "lazy",
      onclick: () => { hero.src = url; window.scrollTo({ top: 0, behavior: "smooth" }); }
    }));
  }
  modal.scrollTop = 0;
}

function renderSizeChart(item) {
  const host = document.getElementById("m-sizechart");
  host.innerHTML = "";
  const sc = item.size_chart;
  if (!sc || !sc.sizes || !sc.measurements) return;
  const fields = Object.keys(sc.measurements);
  const tbl = el("table", { class: "size-chart" });
  const thead = el("thead");
  const hr = el("tr", {}, el("th", {}, ""));
  for (const s of sc.sizes) hr.appendChild(el("th", {}, s));
  thead.appendChild(hr);
  tbl.appendChild(thead);
  const tbody = el("tbody");
  for (const f of fields) {
    const row = el("tr", {}, el("th", {}, f.replace(/_/g, " ")));
    for (const v of sc.measurements[f]) row.appendChild(el("td", {}, String(v)));
    tbody.appendChild(row);
  }
  tbl.appendChild(tbody);
  host.appendChild(el("p", { class: "sc-label" }, `Measurements (${sc.unit || "cm"})`));
  host.appendChild(tbl);
}

function closeModal() {
  document.getElementById("modal").classList.add("hidden");
  document.body.style.overflow = "";
}

document.getElementById("modal-close").addEventListener("click", closeModal);
document.getElementById("modal").addEventListener("click", (e) => {
  if (e.target.id === "modal") closeModal();
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

init();
