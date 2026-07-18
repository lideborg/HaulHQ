// Pure helpers for haul handles + product short codes. Unit-tested with node --test.
export const RESERVED_HANDLES = [
  "admin", "product", "shop", "haul", "f", "api", "_next", "favicon.ico",
];

const ALPHABET =
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function slugify(s) {
  return String(s ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function makeCode(rand = Math.random) {
  let out = "";
  for (let i = 0; i < 5; i++) out += ALPHABET[Math.floor(rand() * ALPHABET.length)];
  return out;
}

export function isValidHandle(h) {
  return /^[a-z0-9-]{2,20}$/.test(h) && !RESERVED_HANDLES.includes(h);
}
