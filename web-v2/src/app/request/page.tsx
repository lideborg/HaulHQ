import { redirect } from "next/navigation";
import { getViewer } from "@/lib/viewer";

// The old standalone request page is superseded by the Factories paste-link
// flow - send friends there (or to login if the session is missing).
export default async function RequestPage() {
  const viewer = await getViewer();
  if (viewer) redirect("/factories");
  redirect("/login");
}
