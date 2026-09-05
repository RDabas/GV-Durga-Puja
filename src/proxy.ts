import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Next.js 16 renamed Middleware to Proxy — same mechanism, new file/export
// name (proxy.ts / `proxy`). A file named middleware.ts is not picked up at
// all under this version, so this convention must be followed exactly.
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
