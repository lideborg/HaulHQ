// App-side mirror of scripts/lib/haul-codes.mjs — keep the two in sync.
export const RESERVED_HANDLES = [
  "admin", "product", "shop", "haul", "f", "api", "_next", "favicon.ico",
];

export function isValidHandle(h: string): boolean {
  return /^[a-z0-9-]{2,20}$/.test(h) && !RESERVED_HANDLES.includes(h);
}
