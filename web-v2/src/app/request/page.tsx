import { redirect } from "next/navigation";
import { getCurrentFriend } from "@/lib/friend";

// The old standalone request page is superseded by the Factories paste-link
// flow - send friends there (or to login if the session is missing).
export default async function RequestPage() {
  const friend = await getCurrentFriend();
  if (friend?.handle) redirect(`/${friend.handle}/factories`);
  redirect("/login");
}
