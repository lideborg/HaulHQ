import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";

// Per-friend login link: /f/<access_token> sets the session cookie and redirects home.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const sb = createAdminClient();
  const { data } = await sb
    .from("friends")
    .select("id")
    .eq("access_token", token)
    .eq("active", true)
    .maybeSingle();

  if (data) {
    (await cookies()).set("friend_token", token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  redirect("/");
}
