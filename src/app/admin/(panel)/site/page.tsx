import type { Metadata } from "next";

import { siteSetting } from "@/lib/settings/site";
import { requireOwner } from "@/lib/staff";
import { PageHead } from "../kit";
import { SiteForm } from "./site-form";

export const metadata: Metadata = { title: "Site settings" };
export const dynamic = "force-dynamic";

export default async function AdminSite() {
  await requireOwner();
  return (
    <div className="space-y-6">
      <PageHead group="Settings" title="Site settings" lead="Things that show on every page: an announcement, your social links, what search engines show, and the footer." />
      <SiteForm initial={await siteSetting.getForAdmin()} />
    </div>
  );
}
