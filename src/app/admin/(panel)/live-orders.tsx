"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Live = { latest: { number: string; paidAt: string | null } | null; toPack: number; attention: number };

const EVERY_MS = 30_000;

/** Two short notes, so staff hear a new order from across the shop. */
function chime(ctx: AudioContext) {
  const t = ctx.currentTime;
  [880, 1320].forEach((hz, i) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = hz;
    g.gain.setValueAtTime(0.0001, t + i * 0.18);
    g.gain.exponentialRampToValueAtTime(0.25, t + i * 0.18 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.18 + 0.35);
    o.connect(g).connect(ctx.destination);
    o.start(t + i * 0.18);
    o.stop(t + i * 0.18 + 0.4);
  });
}

/**
 * Checks for new paid orders every 30 seconds while the admin is open: plays a chime,
 * shows a bar, refreshes the page, and puts the waiting count in the tab title.
 * The first check only remembers the latest order (no chime for orders already there).
 * If the login has ended (401), it stops checking and says so.
 */
export function LiveOrders({ href = "/admin/orders?view=pack", login = "/admin/login" }: { href?: string; login?: string }) {
  const router = useRouter();
  const [fresh, setFresh] = useState<string | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  const seen = useRef<string | null | undefined>(undefined);
  const audio = useRef<AudioContext | null>(null);

  useEffect(() => {
    // Browsers only allow sound after the page has been touched once.
    const unlock = () => {
      audio.current ??= new AudioContext();
      void audio.current.resume();
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });

    let stopped = false;
    async function check() {
      if (stopped || document.visibilityState === "hidden") return;
      try {
        const res = await fetch("/admin/live", { cache: "no-store" });
        if (res.status === 401) {
          // Signed out (elsewhere, or the login expired): stop asking every 30 seconds.
          stopped = true;
          clearInterval(timer);
          setSignedOut(true);
          return;
        }
        if (!res.ok) return;
        const live = (await res.json()) as Live;
        const waiting = live.toPack + live.attention;
        document.title = `${waiting ? `(${waiting}) ` : ""}${document.title.replace(/^\(\d+\) /, "")}`;
        const key = live.latest ? `${live.latest.number}@${live.latest.paidAt}` : null;
        if (seen.current !== undefined && key && key !== seen.current) {
          setFresh(live.latest!.number);
          if (audio.current) chime(audio.current);
          router.refresh();
        }
        seen.current = key;
      } catch {
        // Offline for a moment; try again next time.
      }
    }
    const timer = setInterval(check, EVERY_MS);
    void check();
    const onShow = () => void check();
    document.addEventListener("visibilitychange", onShow);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onShow);
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [router]);

  if (signedOut)
    return (
      <div role="status" aria-live="polite" className="bg-[#fdecee]">
        <div className="container-ep flex min-h-12 items-center justify-between gap-4 text-[15px] font-semibold text-[#9b0010]">
          <span>Signed out. New orders won&apos;t show until you sign in again.</span>
          <a href={login} className="min-h-11 content-center underline underline-offset-2">
            Sign in again
          </a>
        </div>
      </div>
    );
  if (!fresh) return <p role="status" aria-live="polite" className="sr-only" />;
  return (
    <div role="status" aria-live="polite" className="bg-volt">
      <div className="container-ep flex min-h-12 items-center justify-between gap-4 text-[15px] font-semibold text-ink">
        <span>New order {fresh} is paid.</span>
        <span className="flex items-center gap-4">
          <Link href={href} onClick={() => setFresh(null)} className="underline underline-offset-2">
            See it
          </Link>
          <button type="button" onClick={() => setFresh(null)} className="min-h-11 min-w-11" aria-label="Close">
            ✕
          </button>
        </span>
      </div>
    </div>
  );
}
