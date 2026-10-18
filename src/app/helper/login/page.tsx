import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";

import { AdminLoginForm } from "@/app/admin/login/login-form";
import { adminConfigured, currentStaff } from "@/lib/staff";

export const metadata: Metadata = { title: "Helper login", robots: { index: false, follow: false } };

export default async function HelperLogin() {
  if (await currentStaff()) redirect("/helper");
  return (
    <div className="admin-ui grid min-h-dvh place-items-center bg-[#e9e9e7] px-3 py-10">
      <div className="w-full max-w-md rounded-[28px] bg-white/90 p-6 shadow-[0_20px_50px_-40px_rgba(0,0,0,0.3)] sm:p-8">
      <div className="mb-10 flex items-center gap-3">
        <Image src="/brand/logo.png" alt="Easypick" width={611} height={161} className="h-6 w-auto" priority />
        <span className="rounded-full bg-ink px-2.5 py-0.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-paper">Helper</span>
      </div>
      <h1 className="text-[36px] font-light leading-none tracking-[-0.02em]">Helper login</h1>
      <p className="mt-3 text-[15px] text-[#6b6d72]">Pack orders, hand them over, swap sizes and keep stock right.</p>
      {(await adminConfigured()) ? (
        <AdminLoginForm portal="helper" />
      ) : (
        <p className="mt-10 rounded-2xl bg-[#f4f4f2] px-4 py-3 text-[14px]">Staff login isn&apos;t set up yet. Ask the owner.</p>
      )}
      <p className="mt-8 text-[14px] text-[#6b6d72]">No login yet? The owner adds you under Admin → Staff.</p>
      </div>
    </div>
  );
}
