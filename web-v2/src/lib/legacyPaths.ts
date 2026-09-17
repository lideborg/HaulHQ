// Friend pages used to live under /<handle>/… (e.g. /u38403/shop). Those links
// are in friends' bookmarks and old messages, so any path whose first segment
// isn't a known route is treated as a legacy handle prefix and stripped.
// Pure so middleware behavior is unit-testable.

const RESERVED = new Set([
  "shop",
  "haul",
  "welcome",
  "profile",
  "factories",
  "product",
  "login",
  "logout",
  "setup",
  "forgot",
  "reset",
  "account",
  "admin",
  "request",
  "f",
  "api",
]);

export function legacyRedirectPath(pathname: string): string | null {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return null;
  const first = segments[0];
  if (RESERVED.has(first)) return null;
  if (first.includes(".")) return null; // static files (favicon.ico, *.png)
  const rest = segments.slice(1).join("/");
  return rest ? `/${rest}` : "/";
}
