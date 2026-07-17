import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { sha256Hex } from "@/lib/adminAuth";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/login")) {
    const cookie = request.cookies.get("admin_session")?.value;
    const expected = await sha256Hex(process.env.ADMIN_PASSWORD ?? "");
    if (!process.env.ADMIN_PASSWORD || cookie !== expected) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
  }
  return NextResponse.next();
}

export const config = { matcher: "/admin/:path*" };
