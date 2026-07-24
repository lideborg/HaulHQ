// A friend may pick their own login username at setup, or keep the auto-generated
// u##### id. Reserved names are top-level route segments a handle would collide
// with (handles live at the URL root, e.g. /<handle>/shop).
export const RESERVED_USERNAMES = new Set([
  "admin",
  "login",
  "logout",
  "setup",
  "product",
  "products",
  "request",
  "api",
  "shop",
  "haul",
  "profile",
  "welcome",
  "f",
  "_next",
  "assets",
  "static",
]);

// Returns an error code when the username is unacceptable, or null when it's fine.
// Format: 3-20 chars, lowercase letters/numbers/dashes. (Uniqueness is checked
// separately against the database.)
export function usernameError(name: string): "format" | "reserved" | null {
  if (!/^[a-z0-9-]{3,20}$/.test(name)) return "format";
  if (RESERVED_USERNAMES.has(name)) return "reserved";
  return null;
}
