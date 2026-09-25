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
    <div className="container-ep max-w-md pb-16 pt-10 md:pt-16">
      <div className="mb-12 flex items-center justify-between">
        <Image src="/brand/logo.png" alt="Easypick" width={611} height={161} className="h-6 w-auto" priority />
        <Link href="/" className="min-h-11 content-center text-[14px] text-steel-dark hover:text-ink">
          Back to the shop
        </Link>
      </div>
      <h1 className="display display-h1">Staff login.</h1>
      <p className="mt-3 text-lg text-steel-dark">For the Easypick team: orders, stock and products.</p>
      {(await adminConfigured()) ? (
        <AdminLoginForm />
      ) : (
        <p className="mt-10 bg-photo px-4 py-3 text-[14px]">
          Staff login isn&apos;t set up yet. Add <span className="font-mono">ADMIN_USERNAME</span> and <span className="font-mono">ADMIN_PASSWORD</span> to{" "}
          <span className="font-mono">.env.local</span> and restart the site.
        </p>
      )}
    </div>
  );
}
