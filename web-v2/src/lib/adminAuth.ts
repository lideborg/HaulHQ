import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function sha256Hex(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// True when the request carries a valid admin_session cookie. The /admin proxy
// enforces this at the edge; use this for admin-only behavior on routes the
// proxy matcher doesn't cover (e.g. the /product/[id] import preview).
// cache(): several gates may ask per request — hash once.
export const isAdmin = cache(async (): Promise<boolean> => {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return false;
  const cookie = (await cookies()).get("admin_session")?.value;
  return cookie === (await sha256Hex(pw));
});

// Server actions are public POST endpoints no matter what page hosts the
// form — the /admin proxy matcher alone must not be trusted to gate them.
// First line of every admin action.
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) redirect("/admin/login");
}
