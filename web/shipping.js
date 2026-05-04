// Shipping calculator: estimate weight + duty + line cost for a haul.
// Reads web/shipping-data.json. Numbers are planning estimates ±10–15%.

const SHIP = {
  data: null,
  state: {
    lineId: localStorage.getItem("haul.shipLine") || "us-ocean-brands",
    weightProfile: localStorage.getItem("haul.weightProfile") || "typical", // low | typical | high
    declaredPct: parseFloat(localStorage.getItem("haul.declaredPct") || "0.10"),
    weightOverrideKg: null,
  },
};

async function loadShippingData() {
  if (SHIP.data) return SHIP.data;
  const res = await fetch("shipping-data.json");
  SHIP.data = await res.json();
  return SHIP.data;
}

function categoryKey(item) {
  if (!SHIP.data) return "_default";
  const c = item.category || "";
  // Eyewear in subcategories
  const cat = c.toLowerCase();
  if (cat.startsWith("apparel-")) {
    return SHIP.data.category_aliases[cat] || (cat === "apparel-bottom" ? "pants" : "shirt");
  }
  if (SHIP.data.category_aliases[cat]) return SHIP.data.category_aliases[cat];
  if (SHIP.data.weights[cat]) return cat;
  return "_default";
}

function weightFor(item) {
  if (!SHIP.data) return [0.5, 1.15];
  const key = categoryKey(item);
  const row = SHIP.data.weights[key] || SHIP.data.weights._default;
  const idx = { low: 0, typical: 1, high: 2 }[SHIP.state.weightProfile] ?? 1;
  return [row[idx], row[3]]; // [kg, vol_mult]
}

function tariffRateFor(item) {
  if (!SHIP.data) return 0.4;
  const key = categoryKey(item);
  return (SHIP.data.tariffs[key] || SHIP.data.tariffs._default).rate;
}

function priceCnyOf(item) {
  const m = String(item.price || "").match(/[¥￥]\s*(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : 0;
}

function estimateWeight(items) {
  let actual = 0, charged = 0;
  for (const it of items) {
    const [kg, mult] = weightFor(it);
    actual += kg;
    charged += kg * mult;
  }
  return { actual, charged };
}

// Linear interpolation across the line's posted tier breakpoints.
function interpolateRate(line, kg) {
  const tiers = Object.entries(line.tiers)
    .map(([k, v]) => [parseFloat(k), v])
    .sort((a, b) => a[0] - b[0]);
  // Apply min weight floor
  const billable = Math.max(kg, line.min_kg || 0);
  if (billable <= tiers[0][0]) return tiers[0][1] * (billable / tiers[0][0]);
  for (let i = 0; i < tiers.length - 1; i++) {
    const [w1, p1] = tiers[i], [w2, p2] = tiers[i + 1];
    if (billable >= w1 && billable <= w2) {
      const frac = (billable - w1) / (w2 - w1);
      return p1 + frac * (p2 - p1);
    }
  }
  // Above max tier: extrapolate using the last slope
  const [w1, p1] = tiers[tiers.length - 2], [w2, p2] = tiers[tiers.length - 1];
  const slope = (p2 - p1) / (w2 - w1);
  return p2 + slope * (billable - w2);
}

function estimateDuty(items, line, declaredValueUsd) {
  if (!line || line.tariff_handling === "tariffless" || line.tariff_handling === "ddp") {
    return 0;
  }
  // Recipient pays. Apply weighted blended rate based on item subtotals.
  const totalCny = items.reduce((s, it) => s + priceCnyOf(it), 0);
  if (totalCny === 0) return 0;
  let weightedRate = 0;
  for (const it of items) {
    const w = priceCnyOf(it) / totalCny;
    weightedRate += w * tariffRateFor(it);
  }
  return declaredValueUsd * weightedRate;
}

function calcShipping(items) {
  if (!SHIP.data) return null;
  const line = SHIP.data.lines.find(l => l.id === SHIP.state.lineId) || SHIP.data.lines[0];
  const w = estimateWeight(items);
  const billableKg = SHIP.state.weightOverrideKg ?? w.charged;
  const baseShipping = interpolateRate(line, billableKg);
  const fees = baseShipping * (SHIP.data.fees.superbuy_payment_pct || 0)
             + (SHIP.data.fees.agent_handling_per_parcel_usd || 0);
  const itemsCny = items.reduce((s, it) => s + priceCnyOf(it), 0);
  const itemsUsd = itemsCny / (SHIP.data._meta.currency_assumptions.cny_per_usd || 6.83);
  const declaredUsd = itemsUsd * SHIP.state.declaredPct;
  const duty = estimateDuty(items, line, declaredUsd);
  const total = itemsUsd + baseShipping + fees + duty;
  return {
    line, weight: w, billableKg, baseShipping, fees, itemsUsd, declaredUsd, duty, total
  };
}

// ---------- UI ----------

function renderShippingPanel(items) {
  if (!SHIP.data || !items.length) return el("div", { class: "ship-panel hidden" });
  const wrap = el("div", { class: "ship-panel" });
  wrap.appendChild(el("h3", { class: "ship-title" }, "Shipping & Duty Estimate"));

  const c = calcShipping(items);
  if (!c) return wrap;

  // Line dropdown + profile + declared %
  const controls = el("div", { class: "ship-controls" });

  const lineSel = el("select", {
    onchange: (e) => {
      SHIP.state.lineId = e.target.value;
      localStorage.setItem("haul.shipLine", SHIP.state.lineId);
      rerender();
    },
  });
  for (const l of SHIP.data.lines) {
    const o = el("option", { value: l.id }, `${l.label} (${l.transit_days[0]}–${l.transit_days[1]}d)`);
    if (l.id === SHIP.state.lineId) o.setAttribute("selected", "");
    lineSel.appendChild(o);
  }
  controls.appendChild(el("label", { class: "ship-field" }, "Line", lineSel));

  const profSel = el("select", {
    onchange: (e) => {
      SHIP.state.weightProfile = e.target.value;
      localStorage.setItem("haul.weightProfile", SHIP.state.weightProfile);
      rerender();
    },
  });
  for (const p of ["low", "typical", "high"]) {
    const o = el("option", { value: p }, p[0].toUpperCase() + p.slice(1));
    if (p === SHIP.state.weightProfile) o.setAttribute("selected", "");
    profSel.appendChild(o);
  }
  controls.appendChild(el("label", { class: "ship-field" }, "Weight profile", profSel));

  const declaredInput = el("input", {
    type: "number", step: "1", min: "1", max: "100",
    value: String(Math.round(SHIP.state.declaredPct * 100)),
    onchange: (e) => {
      const pct = parseFloat(e.target.value);
      if (Number.isFinite(pct) && pct > 0) {
        SHIP.state.declaredPct = pct / 100;
        localStorage.setItem("haul.declaredPct", String(SHIP.state.declaredPct));
        rerender();
      }
    },
  });
  controls.appendChild(el("label", { class: "ship-field" },
    "Declared value (% of subtotal)",
    el("div", { class: "ship-pct-wrap" }, declaredInput, el("span", {}, "%"))
  ));
  wrap.appendChild(controls);

  // Breakdown table
  const fmtUsd = n => `$${n.toFixed(0)}`;
  const fmtKg = n => `${n.toFixed(2)} kg`;
  const ddp = c.line.tariff_handling === "ddp" || c.line.tariff_handling === "tariffless";

  const rows = el("dl", { class: "ship-rows" });
  const row = (k, v, sub) => {
    rows.appendChild(el("dt", {}, k));
    rows.appendChild(el("dd", {}, v, sub ? el("span", { class: "ship-sub" }, ` ${sub}`) : null));
  };
  row("Item subtotal", fmtUsd(c.itemsUsd), `(${items.length} items)`);
  row("Weight (actual / charged)",
    `${fmtKg(c.weight.actual)} / ${fmtKg(c.weight.charged)}`,
    c.line.min_kg && c.billableKg === c.line.min_kg ? `floor: ${c.line.min_kg} kg` : null
  );
  row("Shipping (line)", fmtUsd(c.baseShipping), `${fmtKg(c.billableKg)} via ${c.line.label.split(" (")[0]}`);
  row("Agent fees", fmtUsd(c.fees), "3% payment + repack");
  if (ddp) {
    row("Duty / tariff", fmtUsd(0), c.line.tariff_handling === "ddp" ? "DDP — bundled into shipping" : "tariffless lane");
  } else {
    row("Declared value", fmtUsd(c.declaredUsd), `${Math.round(SHIP.state.declaredPct * 100)}% of subtotal`);
    row("Duty / tariff (recipient)", fmtUsd(c.duty), "blended rate by category");
  }
  wrap.appendChild(rows);

  // Total
  const total = el("div", { class: "ship-total" },
    el("span", {}, "Estimated all-in"),
    el("span", { class: "ship-total-amount" }, fmtUsd(c.total)),
  );
  wrap.appendChild(total);

  // Caveat
  wrap.appendChild(el("p", { class: "ship-caveat" },
    `Estimates ±10–15%. ${ddp
      ? "DDP / tariffless lines bundle (or under-declare) duty into shipping; the recipient typically sees no separate duty bill."
      : "Recipient-pays line: carrier will invoice duty at delivery based on the actual customs declaration."}`
  ));

  return wrap;
}
