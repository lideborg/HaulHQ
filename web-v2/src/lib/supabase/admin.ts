import { createClient } from "@supabase/supabase-js";

// Privileged server-only client — uses the service_role key. NEVER import into a
// client component. For server actions / route handlers that bypass RLS
// (friend-token auth, admin writes, scrape endpoint).
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
