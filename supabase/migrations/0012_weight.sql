-- Approximate shipped weight per item (grams, incl. light packaging).
-- Estimated by scripts/estimate-weights.mjs (Gemini, category+title heuristics);
-- drives the haul shipping estimate.
alter table products add column if not exists weight_g integer;
