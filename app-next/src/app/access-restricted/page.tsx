import Link from "next/link";
import { getServerSession } from "next-auth";
import { ShieldOff } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { AccessRestrictedSignOut } from "@/components/auth/AccessRestrictedSignOut";
import { PRODUCT_NAME } from "@/lib/branding";

export const metadata = {
  title: `Access restricted — ${PRODUCT_NAME}`,
};

export default async function AccessRestrictedPage() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email ?? null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 px-4 py-12">
      <div className="w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm p-8 text-center space-y-5">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-200">
          <ShieldOff className="h-7 w-7" aria-hidden />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Access restricted</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            {PRODUCT_NAME} is in a closed pilot this week. Your account is not on the approved test list yet.
          </p>
          {email ? (
            <p className="text-xs text-slate-500 dark:text-slate-500">
              Signed in as <span className="font-medium text-slate-700 dark:text-slate-300">{email}</span>
            </p>
          ) : null}
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          If you should have access, contact your fleet administrator with the email address you use to sign in.
        </p>
        <div className="flex flex-col gap-2 pt-2">
          <AccessRestrictedSignOut />
          <Link
            href="/"
            className="text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 underline-offset-2 hover:underline"
          >
            Back to sign-in
          </Link>
        </div>
      </div>
    </div>
  );
}
