import { Suspense } from "react";
import { headers } from "next/headers";
import { AppLanding } from "@/components/lobby/AppLanding";
import { getAppSurface, type AppSurface } from "@/lib/app-surface";

async function Landing() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const surface: AppSurface = getAppSurface(host);
  return <AppLanding surface={surface} />;
}

/** Product landing — branches filtered by APP_SURFACE / Host (legacy | ewd | enterprise). */
export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
          Loading…
        </div>
      }
    >
      <Landing />
    </Suspense>
  );
}
