import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FileCheck2, LockKeyhole, ShieldCheck } from "lucide-react";
import { APP_NAME, safeRedirectPath } from "@/lib/config";
import { getSessionUser } from "@/lib/server/session";
import { LoginForm } from "@/components/auth/LoginForm";
import { BrandMark } from "@/components/shell/BrandMark";

export const metadata: Metadata = { title: "Sign in" };

const highlights = [
  { icon: ShieldCheck, text: "Access limited to the categories assigned to your account" },
  { icon: FileCheck2, text: "Complete, save and submit structured forms" },
  { icon: LockKeyhole, text: "Sessions protected by HttpOnly cookies and server-side checks" },
];

export default function LoginPage({ searchParams }: { searchParams: { next?: string | string[] } }) {
  const next = typeof searchParams.next === "string" ? searchParams.next : undefined;
  if (getSessionUser()) redirect(safeRedirectPath(next));

  return (
    <div className="flex min-h-screen w-full bg-canvas">
      <aside className="relative hidden w-[44%] max-w-[620px] flex-col justify-between overflow-hidden bg-[radial-gradient(circle_at_15%_20%,rgba(93,80,168,0.28),transparent_45%),radial-gradient(circle_at_80%_80%,rgba(77,65,141,0.32),transparent_40%),linear-gradient(135deg,#141124_0%,#272147_55%,#3a316a_100%)] px-12 py-12 text-white lg:flex xl:px-16">
        <BrandMark inverted />
        <div className="max-w-md">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#cbc4f4]">Internal tools</p>
          <h2 className="mt-4 text-[34px] font-semibold leading-[1.15] tracking-tight">{APP_NAME}</h2>
          <p className="mt-4 text-[15px] leading-relaxed text-white/75">One secure place for the forms your team relies on every day.</p>
          <ul className="mt-10 space-y-5">
            {highlights.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3.5 text-[15px] leading-snug text-white/90">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/15 bg-white/[0.06]">
                  <Icon className="h-[18px] w-[18px] text-[#cbc4f4]" aria-hidden="true" strokeWidth={1.8} />
                </span>
                <span className="pt-2">{text}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-white/60">Authorized use only.</p>
      </aside>

      <main className="flex flex-1 flex-col px-4 py-8 sm:px-8">
        <div className="lg:invisible">
          <BrandMark compact />
        </div>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[420px]">
            <div className="rounded-2xl border border-line bg-surface px-6 py-8 shadow-[0_24px_48px_-32px_rgba(39,33,71,0.35)] sm:px-9 sm:py-10">
              <h1 className="text-[26px] font-semibold tracking-tight text-primary">Sign in</h1>
              <p className="mb-7 mt-2 text-[15px] leading-relaxed text-muted">Use your work account to access your forms.</p>
              <LoginForm next={next} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
