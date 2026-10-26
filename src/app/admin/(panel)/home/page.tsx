import type { Metadata } from "next";
import Link from "next/link";

import { homeSetting } from "@/lib/settings/home";
import { categoryLabels } from "@/lib/site";
import { requireOwner } from "@/lib/staff";
import type { Category } from "@/lib/types";
import { PageHead } from "../kit";
import { HomeForm } from "./home-form";

export const metadata: Metadata = { title: "Drops page" };
export const dynamic = "force-dynamic";

export default async function AdminHome() {
  await requireOwner();
  const initial = await homeSetting.getForAdmin();
  const kinds = (Object.keys(categoryLabels) as Category[]).map((id) => ({ id, label: categoryLabels[id] }));
  return (
    <div className="space-y-6">
      <PageHead group="Storefront" title="Drops page" lead="Every section of the Drops page (what was the home page until 26 Oct 2026): what shows, in which order, and every line of text on it.">
        <Link href="/drops" target="_blank" className="inline-flex h-10 items-center rounded-full border border-ink/15 bg-white px-4 text-[13.5px] font-semibold hover:border-ink">
          See the Drops page ↗
        </Link>
      </PageHead>
      <HomeForm initial={initial} kinds={kinds} />
    </div>
  );
}
