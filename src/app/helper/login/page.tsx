import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";

import { AdminLoginForm } from "@/app/admin/login/login-form";
import { adminConfigured, currentStaff } from "@/lib/staff";

export const metadata: Metadata = { title: "Helper login", robots: { index: false, follow: false } };

export default async function HelperLogin() {
  if (await currentStaff()) redirect("/helper");
  return (
    <div className="container-ep max-w-md pb-16 pt-10 md:pt-16">
      <div className="mb-12 flex items-center gap-3">
        <Image src="/brand/logo.png" alt="Easypick" width={611} height={161} className="h-6 w-auto" priority />
        <span className="rounded-[2px] bg-volt px-2 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-ink">Helper</span>
      </div>
      <h1 className="display display-h1">Helper login.</h1>
      <p className="mt-3 text-lg text-steel-dark">Pack orders, hand them over, swap sizes and keep stock right.</p>
      {(await adminConfigured()) ? (
        <AdminLoginForm portal="helper" />
      ) : (
        <p className="mt-10 bg-photo px-4 py-3 text-[14px]">Staff login isn&apos;t set up yet. Ask the owner.</p>
      )}
      <p className="mt-8 text-[14px] text-steel-dark">No login yet? The owner adds you under Admin → Staff.</p>
    </div>
  );
}
