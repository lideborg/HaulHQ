"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sha256Hex } from "@/lib/adminAuth";

export async function login(formData: FormData) {
  const pw = String(formData.get("password") ?? "");
  if (pw && pw === process.env.ADMIN_PASSWORD) {
    (await cookies()).set("admin_session", await sha256Hex(pw), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    redirect("/admin");
  }
  redirect("/admin/login?error=1");
}
