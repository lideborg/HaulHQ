import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ftInToCm, lbsToKg, jeansWaistToCm, shoeToFootCm,
  estimateChestCm, estimateWaistCm, estimateFootCm,
} from "./sizing.ts";

test("unit conversions", () => {
  assert.equal(ftInToCm(5, 11), 180.3);
  assert.equal(lbsToKg(165), 74.8);
  assert.equal(jeansWaistToCm(32), 86.4); // (32+2)*2.54, vanity offset
});

test("shoe size to foot cm", () => {
  assert.equal(shoeToFootCm("us", 9, "male"), 26.8);
  assert.equal(shoeToFootCm("us", 8, "male"), 26.0);
  assert.equal(shoeToFootCm("eu", 42), 26.7);
  assert.equal(shoeToFootCm("eu", 41), 26.0);
  // women's US runs 1.5 sizes offset from men's on the same last
  assert.equal(shoeToFootCm("us", 8, "female"), shoeToFootCm("us", 6.5, "male"));
  assert.equal(shoeToFootCm("us", NaN, "male"), null);
  // explicit US Women's system needs no gender field to convert correctly
  assert.equal(shoeToFootCm("us-w", 8), shoeToFootCm("us", 6.5, "male"));
  assert.equal(shoeToFootCm("us-w", 9.5, "female"), shoeToFootCm("us", 8, "male"));
});

test("chest estimation from height/weight/gender", () => {
  // male anchors: 180/75 ≈ 99, 170/60 ≈ 89, 190/95 ≈ 112 (±2cm)
  const est = (h: number, w: number, g: "male" | "female") =>
    estimateChestCm({ gender: g, height_cm: h, weight_kg: w })!;
  assert.ok(Math.abs(est(180, 75, "male") - 99) <= 2);
  assert.ok(Math.abs(est(170, 60, "male") - 89) <= 2);
  assert.ok(Math.abs(est(190, 95, "male") - 112) <= 2);
  assert.ok(est(170, 60, "female") < est(170, 60, "male"));
  // missing inputs → null
  assert.equal(estimateChestCm({ height_cm: 180 }), null);
});

test("explicit measurements override estimates", () => {
  const m = {
    gender: "male" as const, height_cm: 180, weight_kg: 75,
    jeans_waist_in: 32, shoe: { system: "us" as const, value: 9 },
    explicit: { chest_cm: 104, foot_cm: 27.2 },
  };
  assert.equal(estimateChestCm(m), 104);
  assert.equal(estimateFootCm(m), 27.2);
  assert.equal(estimateWaistCm(m), 86.4); // no explicit waist → jeans-derived
  // A measured waist takes priority over the jeans-size proxy.
  assert.equal(estimateWaistCm({ ...m, explicit: { ...m.explicit, waist_cm: 82 } }), 82);
});

test("estimateWaistCm and estimateFootCm fall back to null", () => {
  assert.equal(estimateWaistCm({}), null);
  assert.equal(estimateFootCm({}), null);
});

import { recommendSize } from "./sizing.ts";

const HAMPUS = {
  gender: "male" as const, height_cm: 183, weight_kg: 72,
  jeans_waist_in: 31, shoe: { system: "eu" as const, value: 41 },
  fit_pref: "true" as const,
};

test("recommendSize: top via chest chart, true-to-size ease band", () => {
  const rec = recommendSize(HAMPUS, {
    category: "t-shirts",
    size_options: ["S", "M", "L", "XL"],
    size_guide: {
      unit: "cm", sizes: ["S", "M", "L", "XL"],
      measurements: { chest: [104, 108, 112, 116], length: [68, 70, 72, 74] },
    },
  });
  // body chest ≈ 98; true band mid = +11 → 108–112 closest ⇒ M (108, ease 10)
  assert.equal(rec!.size, "M");
  assert.match(rec!.reason, /chest 108cm/);
  assert.match(rec!.reason, /~98(\.\d)?cm/); // estimate lands at 98.1
});

test("recommendSize: bust + half_chest aliases and inch charts normalize", () => {
  const bust = recommendSize(HAMPUS, {
    category: "shirts", size_options: ["M", "L"],
    size_guide: { unit: "cm", sizes: ["M", "L"], measurements: { bust: [108, 112] } },
  });
  assert.equal(bust!.size, "M");
  const half = recommendSize(HAMPUS, {
    category: "shirts", size_options: ["M", "L"],
    size_guide: { unit: "cm", sizes: ["M", "L"], measurements: { pit_to_pit: [54, 56] } },
  });
  assert.equal(half!.size, "M"); // 54×2 = 108
  const inches = recommendSize(HAMPUS, {
    category: "shirts", size_options: ["M", "L"],
    size_guide: { unit: "in", sizes: ["M", "L"], measurements: { chest: [42.5, 44] } },
  });
  assert.equal(inches!.size, "M"); // 42.5in = 108cm
});

test("recommendSize: fit preference shifts the pick", () => {
  const chart = {
    category: "hoodies", size_options: ["S", "M", "L", "XL"],
    size_guide: {
      unit: "cm" as const, sizes: ["S", "M", "L", "XL"],
      measurements: { chest: [104, 110, 116, 122] },
    },
  };
  assert.equal(recommendSize({ ...HAMPUS, fit_pref: "slim" }, chart)!.size, "S");
  assert.equal(recommendSize({ ...HAMPUS, fit_pref: "oversized" }, chart)!.size, "L");
});

test("recommendSize: pants match on waist", () => {
  const rec = recommendSize(HAMPUS, {
    category: "pants", size_options: ["46", "48", "50"],
    size_guide: {
      unit: "cm", sizes: ["46", "48", "50"],
      measurements: { waist: [80, 84, 88], length: [100, 102, 104] },
    },
  });
  // jeans 31 → body waist 83.8 → 84 waist +ease band 0–4 ⇒ 48
  assert.equal(rec!.size, "48");
  assert.match(rec!.reason, /waist/);
});

test("recommendSize: shoes work from EU size_options without a chart", () => {
  const rec = recommendSize(HAMPUS, {
    category: "shoes", size_options: ["40", "41", "42", "43"],
    size_guide: null,
  });
  assert.equal(rec!.size, "41"); // EU41 = 26.0cm = his foot
});

test("recommendSize: best chart size missing from size_options → nearest available", () => {
  const rec = recommendSize(HAMPUS, {
    category: "t-shirts",
    size_options: ["S", "L"], // M gone
    size_guide: {
      unit: "cm", sizes: ["S", "M", "L"],
      measurements: { chest: [104, 108, 112] },
    },
  });
  assert.equal(rec!.size, "L");
  assert.match(rec!.reason, /closest available/);
});

test("recommendSize: no guessing", () => {
  const noChart = recommendSize(HAMPUS, {
    category: "t-shirts", size_options: ["S", "M"], size_guide: null,
  });
  assert.equal(noChart, null);
  const noProfile = recommendSize(null, {
    category: "t-shirts", size_options: ["S", "M"],
    size_guide: { unit: "cm", sizes: ["S"], measurements: { chest: [108] } },
  });
  assert.equal(noProfile, null);
  const accessory = recommendSize(HAMPUS, {
    category: "accessories", size_options: [], size_guide: null,
  });
  assert.equal(accessory, null);
});

test("recommendSize: out-of-range body → honest no-fit, not a nearest guess", () => {
  // Foot 23.2cm (US W 6) on a men's-run shoe starting EU 39 (~24.7cm): no fit.
  const rebecca = { gender: "female" as const, shoe: { system: "us-w" as const, value: 6 } };
  const shoes = recommendSize(rebecca, {
    category: "shoes", size_options: ["39", "40", "41", "42", "43", "44"], size_guide: null,
  });
  assert.equal(shoes!.size, null);
  // Advice names the smallest size and how it would sit, never a false match.
  assert.match(shoes!.reason, /EU 39 is the smallest this comes in and it would run roomy/);
  // Same foot against an insole chart that bottoms out at 25.7cm (2.5cm of
  // slop, past the 2.2cm tolerance): no fit.
  const insole = recommendSize(rebecca, {
    category: "shoes", size_options: ["40", "41"],
    size_guide: { unit: "cm", sizes: ["40", "41"], measurements: { insole: [25.7, 26.4] } },
  });
  assert.equal(insole!.size, null);
  // In-range foot still recommends normally.
  const ok = recommendSize(HAMPUS, {
    category: "shoes", size_options: ["40", "41", "42"], size_guide: null,
  });
  assert.equal(ok!.size, "41");

  // Tops: body chest ~98 vs a chart maxing out at 96 → largest is too small.
  const tooSmall = recommendSize(HAMPUS, {
    category: "t-shirts", size_options: ["S", "M"],
    size_guide: { unit: "cm", sizes: ["S", "M"], measurements: { chest: [92, 96] } },
  });
  assert.equal(tooSmall!.size, null);
  assert.match(tooSmall!.reason, /M is the biggest this comes in and it would run tight/);
  // Tops: chart starting far above the preferred ease band → smallest is too big.
  const tooBig = recommendSize(HAMPUS, {
    category: "t-shirts", size_options: ["L", "XL"],
    size_guide: { unit: "cm", sizes: ["L", "XL"], measurements: { chest: [126, 132] } },
  });
  assert.equal(tooBig!.size, null);
  assert.match(tooBig!.reason, /L is the smallest this comes in and it would fit loose/);

  // Pants: body waist ~84 vs chart maxing at 80 → won't button.
  const pants = recommendSize(HAMPUS, {
    category: "pants", size_options: ["44", "46"],
    size_guide: { unit: "cm", sizes: ["44", "46"], measurements: { waist: [76, 80] } },
  });
  assert.equal(pants!.size, null);

  // Belts: waist 31in against a run ending at 26in → no fit.
  const belt = recommendSize(HAMPUS, {
    category: "accessories", size_options: ["22-24", "24-26"], size_guide: null,
  });
  assert.equal(belt!.size, null);
});

test("recommendSize: stretch-range chart cells parse as midpoints", () => {
  // Elastic waist "78-90" midpoint 84 sits right at his ~83.8cm body waist.
  const rec = recommendSize(HAMPUS, {
    category: "shorts", size_options: ["44", "46"],
    size_guide: {
      unit: "cm", sizes: ["44", "46"],
      measurements: { waist: ["78-90", "82-94"], length: [56, 57] },
    },
  });
  assert.equal(rec!.size, "44");
});

test("recommendSize: belt matches the jeans size to a US waist range", () => {
  const belt = {
    category: "accessories",
    size_options: ["24-26", "26-28", "28-30", "30-33", "33-35"],
    size_guide: null,
  };
  const rec = recommendSize(HAMPUS, belt); // jeans 31 → 30-33
  assert.equal(rec!.size, "30-33");
  assert.match(rec!.reason, /waist/);
  // A measured waist (no jeans size) still works: 82cm ≈ 32in → 30-33.
  assert.equal(
    recommendSize({ explicit: { waist_cm: 82 } }, belt)!.size,
    "30-33",
  );
  // Non-numeric accessory sizes (a cap) → no recommendation.
  assert.equal(
    recommendSize(HAMPUS, {
      category: "accessories", size_options: ["One size"], size_guide: null,
    }),
    null,
  );
});
