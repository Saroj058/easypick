"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { site } from "@/lib/site";

const clock = new Intl.DateTimeFormat("en-GB", { timeZone: site.timezone, hour: "numeric", minute: "2-digit" });

/** Re-reads the order from the server so the tracker shows the latest step. */
export function CheckStatus({ className = "" }: { className?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() =>
          start(() => {
            router.refresh();
            setCheckedAt(new Date());
          })
        }
        disabled={pending}
        className="btn btn-ink w-full sm:w-auto"
      >
        {pending ? "Checking…" : "Check status"}
      </button>
      <p role="status" className="mt-2 min-h-5 text-[13px] text-steel-dark">
        {checkedAt && !pending ? `Up to date · checked at ${clock.format(checkedAt)}` : ""}
      </p>
    </div>
  );
}
