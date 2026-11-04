import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@dr/design-system";
import { appUrls } from "@dr/shared-utilities";

export function AuthFrame({ children, title, lead }: { children: ReactNode; title: string; lead?: string }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <section className="hidden lg:flex flex-col justify-between bg-navy text-[#E6EEEB] p-12 gap-10">
        <a href={appUrls().public}><Logo tone="dark" size={44} /></a>
        <div className="space-y-5 max-w-[30rem]">
          <h2 className="font-display font-extrabold text-[2.2rem] leading-tight text-ivory">One identity. Three levels of access.</h2>
          <ul className="space-y-4 text-sm">
            <li><strong className="text-ivory">Website</strong><br /><span className="text-[#9DB3AE]">Open to everyone — no account needed.</span></li>
            <li><strong className="text-ivory">Engineering Lab</strong><br /><span className="text-[#9DB3AE]">Register and verify your email. Permissions follow your membership category.</span></li>
            <li><strong className="text-ivory">Digital Twin</strong><br /><span className="text-[#9DB3AE]">Invitation or administrator approval per project, with multi-factor authentication.</span></li>
          </ul>
        </div>
        <p className="text-xs text-[#7F9893]">Sessions expire after inactivity. Sign-ins are logged; review active sessions under Account &amp; security.</p>
      </section>
      <section className="flex flex-col items-center justify-center px-4 py-10">
        <div className="lg:hidden mb-6 w-full max-w-[440px]"><Logo size={36} /></div>
        <div className="w-full max-w-[440px] rounded-[18px] border border-line bg-surface p-6 sm:p-8 space-y-4">
          <div><h1 className="font-display font-bold text-2xl">{title}</h1>{lead ? <p className="text-sm text-muted mt-1">{lead}</p> : null}</div>
          {children}
        </div>
        <p className="mt-4 text-xs text-muted">Protected by rate limiting and audit logging. <Link href={appUrls().public} className="underline">Return to website</Link></p>
      </section>
    </div>
  );
}
