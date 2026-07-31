import { headers } from "next/headers";

// Minimal in-memory failure throttle for the two login actions. Per-instance
// only (serverless instances don't share the map), so treat it as a brake on
// casual brute force, not a hard guarantee - good enough for an invite-only
// shop with a handful of users. Successful logins never count against it.
const failures = new Map<string, number[]>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILURES = 8;

export async function clientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "unknown"
  );
}

export function isThrottled(key: string): boolean {
  const now = Date.now();
  const recent = (failures.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  failures.set(key, recent);
  return recent.length >= MAX_FAILURES;
}

export function recordFailure(key: string): void {
  const list = failures.get(key) ?? [];
  list.push(Date.now());
  failures.set(key, list);
  // Keep the map from growing without bound on a long-lived instance.
  if (failures.size > 10_000) failures.clear();
}

// A flat delay on every failed attempt caps the guess rate even when the
// per-instance map has been reset.
export function failureDelay(): Promise<void> {
  return new Promise((r) => setTimeout(r, 750));
}
