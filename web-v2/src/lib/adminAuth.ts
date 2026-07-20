import { cookies } from "next/headers";

export async function sha256Hex(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// True when the request carries a valid admin_session cookie. The /admin proxy
// enforces this at the edge; use this for admin-only behavior on routes the
// proxy matcher doesn't cover (e.g. the /product/[id] import preview).
export async function isAdmin(): Promise<boolean> {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return false;
  const cookie = (await cookies()).get("admin_session")?.value;
  return cookie === (await sha256Hex(pw));
}
