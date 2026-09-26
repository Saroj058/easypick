import type { Metadata } from "next";

import { removeStaffAction } from "@/app/admin/actions";
import { signOutStaffAction } from "@/app/admin/staff-actions";
import { MIN_PASSWORD, requireOwner, staffList } from "@/lib/staff";
import { site } from "@/lib/site";
import { AddStaffForm } from "./add-staff-form";
import { ResetPasswordForm } from "./staff-tools";

export const metadata: Metadata = { title: "Staff" };
export const dynamic = "force-dynamic";

const day = new Intl.DateTimeFormat("en-GB", { timeZone: site.timezone, day: "numeric", month: "short", year: "numeric" });

export default async function AdminStaff() {
  const me = await requireOwner();
  const list = await staffList();
  const owners = list.filter((s) => s.role === "owner").length;

  return (
    <div className="max-w-2xl space-y-12">
      <section aria-labelledby="staff-h">
        <h2 id="staff-h" className="display text-[32px] md:text-[40px]">
          Staff
        </h2>
        <p className="mt-2 text-steel-dark">Everyone who can sign in to the admin. Each person has their own login, so the activity log shows who did what.</p>
        <ul className="mt-6 divide-y divide-mist border-y border-mist">
          {list.map((s) => {
            const lastOwner = s.role === "owner" && owners <= 1;
            return (
              <li key={s.id} className="flex flex-wrap items-start justify-between gap-3 py-4">
                <div>
                  <p className="font-semibold">
                    {s.username}
                    {s.id === me.id && <span className="font-normal text-steel-dark"> (you)</span>}
                  </p>
                  <p className="text-[14px] text-steel-dark">
                    {s.role === "owner" ? "Owner" : "Helper"} · added {day.format(new Date(s.createdAt))}
                  </p>
                  {s.id !== me.id && <ResetPasswordForm id={s.id} username={s.username} min={MIN_PASSWORD} />}
                </div>
                {s.id !== me.id && (
                  <div className="flex flex-col items-end">
                    <form action={signOutStaffAction}>
                      <input type="hidden" name="id" value={s.id} />
                      <button type="submit" className="min-h-11 text-[14px] underline underline-offset-2">
                        Sign out all their devices
                      </button>
                    </form>
                    {!lastOwner && (
                      <form action={removeStaffAction}>
                        <input type="hidden" name="id" value={s.id} />
                        <button type="submit" className="min-h-11 text-[14px] text-[#d70015] underline underline-offset-2">
                          Remove {s.username}
                        </button>
                      </form>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
      <div className="border-t border-mist pt-8">
        <AddStaffForm min={MIN_PASSWORD} />
      </div>
    </div>
  );
}
