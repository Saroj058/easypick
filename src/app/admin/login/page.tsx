import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { adminConfigured, currentStaff, staffHome } from "@/lib/staff";
import { AdminLoginForm } from "./login-form";

export const metadata: Metadata = { title: "Staff login", robots: { index: false, follow: false } };

export default async function AdminLogin() {
  const who = await currentStaff();
  if (who) redirect(staffHome(who));
  return (
    <div className="admin-ui grid min-h-dvh place-items-center bg-[#e9e9e7] px-3 py-10">
      <div className="w-full max-w-md rounded-[28px] bg-white/90 p-6 shadow-[0_20px_50px_-40px_rgba(0,0,0,0.3)] sm:p-8">
      <div className="mb-10 flex items-center justify-between">
        <Image src="/brand/logo.png" alt="Easypick" width={611} height={161} className="h-6 w-auto" priority />
        <Link href="/" className="min-h-11 content-center text-[14px] text-[#6b6d72] hover:text-ink">
          Back to the shop
        </Link>
      </div>
      <h1 className="text-[36px] font-light leading-none tracking-[-0.02em]">Staff login</h1>
      <p className="mt-3 text-[15px] text-[#6b6d72]">For the Easypick team: orders, stock and products.</p>
      {(await adminConfigured()) ? (
        <AdminLoginForm />
      ) : (
        <p className="mt-10 rounded-2xl bg-[#f4f4f2] px-4 py-3 text-[14px]">
          Staff login isn&apos;t set up yet. Add <span className="font-mono">ADMIN_USERNAME</span> and <span className="font-mono">ADMIN_PASSWORD</span> to{" "}
          <span className="font-mono">.env.local</span> and restart the site.
        </p>
      )}
      </div>
    </div>
  );
}
