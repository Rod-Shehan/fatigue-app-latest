import { Suspense } from "react";
import { AppLanding } from "@/components/lobby/AppLanding";

/** Single app landing — Driver, Manager, Organisation branches + sign-in. */
export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
          Loading…
        </div>
      }
    >
      <AppLanding />
    </Suspense>
  );
}
