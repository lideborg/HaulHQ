import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";

// Per-friend login link: /f/<access_token> sets the session cookie and drops the
// friend into their own shop. Falls back to "/" only if the token is invalid or
// the friend has no handle.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const sb = createAdminClient();
  const { data } = await sb
    .from("friends")
    .select("id, handle")
    .eq("access_token", token)
    .eq("active", true)
    .maybeSingle();

  if (data) {
    (await cookies()).set("friend_token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    if (data.handle) redirect(`/${data.handle}/shop`);
  }
  redirect("/");
}
