import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { adminConfigured, currentStaff } from "@/lib/staff";
import { AdminLoginForm } from "./login-form";

export const metadata: Metadata = { title: "Staff login", robots: { index: false, follow: false } };

export default async function AdminLogin() {
  if (await currentStaff()) redirect("/admin");
  return (
    <div className="container-ep max-w-md pb-24 pt-12 md:pt-20">
      <h1 className="display display-h1">Staff login.</h1>
      <p className="mt-3 text-lg text-steel-dark">For the Easypick team: orders, stock and products.</p>
      {adminConfigured() ? (
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
