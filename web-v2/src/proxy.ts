import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { sha256Hex } from "@/lib/adminAuth";
import { legacyRedirectPath } from "@/lib/legacyPaths";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/login")) {
    const cookie = request.cookies.get("admin_session")?.value;
    const expected = await sha256Hex(process.env.ADMIN_PASSWORD ?? "");
    if (!process.env.ADMIN_PASSWORD || cookie !== expected) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
  }
  // Legacy /<handle>/… links (old bookmarks/messages) → session-based routes.
  const target = legacyRedirectPath(pathname);
  if (target) {
    const url = request.nextUrl.clone();
    url.pathname = target;
    return NextResponse.redirect(url, 307);
  }
  return NextResponse.next();
}

// Everything except Next internals and static files (dot in last segment).
export const config = { matcher: "/((?!_next|.*\\.).*)" };
