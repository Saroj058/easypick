"use client";

import { useActionState, useState } from "react";

import type { SaveState } from "@/app/admin/actions";
import { saveSiteAction } from "@/app/admin/settings-actions";
import type { SiteSettings } from "@/lib/settings/site-rules";
import { Card, SaveBar, Switch, Text, input } from "../kit";

export function SiteForm({ initial }: { initial: SiteSettings }) {
  const [state, action, pending] = useActionState<SaveState, FormData>(saveSiteAction, { status: "idle" });
  const [v, setV] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const dirty = JSON.stringify(v) !== JSON.stringify(saved);
  const set = <K extends keyof SiteSettings>(k: K, patch: Partial<SiteSettings[K]>) => setV((cur) => ({ ...cur, [k]: { ...cur[k], ...patch } }));

  return (
    <form
      action={(fd) => {
        setSaved(v);
        action(fd);
      }}
      className="space-y-4"
    >
      <input type="hidden" name="data" value={JSON.stringify(v)} />

      <Card title="Announcement" note="A short message in a slim pill under the header, on every shop page. People can close it; a new message shows again.">
        <Switch label="Show the announcement" on={v.announcement.on} onChange={(on) => set("announcement", { on })} />
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_180px]">
          <Text label="Message" value={v.announcement.text} onChange={(text) => set("announcement", { text })} max={120} placeholder="Dashain sale: up to 36% off" />
          <Text label="Link" hint="optional, e.g. /shop?sale=1" value={v.announcement.link} onChange={(link) => set("announcement", { link })} max={300} />
          <label className="block">
            <span className="text-[13px] font-semibold">
              Last day <span className="font-normal text-[#6b6d72]">(optional)</span>
            </span>
            <input type="date" value={v.announcement.until} onChange={(e) => set("announcement", { until: e.target.value })} className={input} />
          </label>
        </div>
        {v.announcement.on && v.announcement.text && (
          <div className="mt-4 flex justify-center rounded-2xl bg-white p-4">
            <span className="rounded-full bg-ink px-4 py-1.5 text-[13px] font-semibold text-paper">
              {v.announcement.text} {v.announcement.link && "→"}
            </span>
          </div>
        )}
      </Card>

      <Card title="Social links" note="Full links, e.g. https://www.instagram.com/easypick. Empty ones don't show. They appear in the footer, on About, and tell search engines who you are.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Text label="Instagram" value={v.social.instagram} onChange={(instagram) => set("social", { instagram })} max={300} />
          <Text label="TikTok" value={v.social.tiktok} onChange={(tiktok) => set("social", { tiktok })} max={300} />
          <Text label="Facebook" value={v.social.facebook} onChange={(facebook) => set("social", { facebook })} max={300} />
          <Text label="YouTube" value={v.social.youtube} onChange={(youtube) => set("social", { youtube })} max={300} />
        </div>
      </Card>

      <Card title="Search engines" note="The short description Google and link previews show for the site.">
        <Text label="Description" value={v.seo.description} onChange={(description) => set("seo", { description })} max={300} long />
        <p className="mt-1 text-right font-mono text-[11px] text-[#6b6d72]">{v.seo.description.length}/160 shown by Google</p>
      </Card>

      <Card title="Footer" note="The drop-alert sign-up at the bottom of the home page.">
        <Switch label="Show the sign-up box" on={v.footer.alertsOn} onChange={(alertsOn) => set("footer", { alertsOn })} />
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Text label="Title" value={v.footer.alertsTitle} onChange={(alertsTitle) => set("footer", { alertsTitle })} max={40} />
          <Text label="Small print" value={v.footer.alertsNote} onChange={(alertsNote) => set("footer", { alertsNote })} max={160} />
        </div>
      </Card>

      <SaveBar pending={pending} dirty={dirty} message={state.status === "idle" ? undefined : state.message} error={state.status === "error"} onReset={() => setV(saved)} />
    </form>
  );
}
