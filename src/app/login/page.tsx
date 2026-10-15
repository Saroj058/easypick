import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { LoginPanel } from "@/components/login-panel";
import { codeChannels, getCurrentUser, safeNext } from "@/lib/auth";
import { isConfigured } from "@/lib/oauth";

export const metadata: Metadata = { title: "Log in or sign up", robots: { index: false } };

const errors: Record<string, string> = {
  google_not_configured: "Google sign-in isn't set up yet. Use your phone for now.",
  facebook_not_configured: "Facebook sign-in isn't set up yet. Use your phone for now.",
  cancelled: "Sign-in was cancelled. Try again whenever you're ready.",
  expired: "That sign-in link expired. Please try again.",
  provider: "We couldn't reach the sign-in service. Please try again.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  const user = await getCurrentUser();

  // Signed in with Google/Facebook and adding a phone number to the account.
  if (user && sp.add === "phone" && !user.phone) {
    return (
      <div className="container-ep max-w-xl pb-24 pt-10 md:pt-16">
        <h1 className="display display-h1">Add your phone.</h1>
        <p className="mt-4 text-lg text-steel-dark">For order SMS, and so kiosk bills land in your account.</p>
        <div className="mt-10">
          <LoginPanel next={next} phoneOnly channels={codeChannels()} providers={{ google: false, facebook: false }} />
        </div>
      </div>
    );
  }
  if (user) redirect(next);

  const signup = sp.mode === "signup";
  const forBag = sp.reason === "bag";
  const error = typeof sp.error === "string" ? errors[sp.error] : undefined;

  return (
    <div className="container-ep grid gap-10 pb-24 pt-8 md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] md:items-stretch md:gap-14 md:pt-10 lg:gap-20">
      {/* The store itself, and why an account is worth it. Larger screens only: on a phone the form comes first. */}
      <aside className="relative hidden min-h-[600px] overflow-hidden rounded-[28px] bg-ink text-paper md:block">
        <Image src="/drops/hero-2.webp" alt="" fill priority sizes="50vw" className="object-cover object-[72%_50%] opacity-90" />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/10" />
        <div className="absolute inset-x-0 bottom-0 p-8 lg:p-10">
          <p className="index text-paper/60">Pick it · Pay it · Wear it</p>
          <p className="display mt-3 text-[clamp(2.4rem,1.6rem+2vw,3.4rem)] leading-[0.92]">One account. The website and the store.</p>
          <ul className="mt-6 space-y-2.5 text-[15px] text-paper/85">
            {["Your size, saved: every piece marks it", "Orders, gift links and gift cards in one place", "Checkout and gifts filled in for you"].map((t) => (
              <li key={t} className="flex items-start gap-3">
                <span aria-hidden className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-volt" />
                {t}
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <div className="mx-auto flex w-full max-w-[400px] flex-col justify-center md:py-10">
        <h1 className="display text-[clamp(2.6rem,2rem+2vw,3.6rem)] leading-[0.92]">{forBag ? "Confirm your number." : signup ? "Join Easypick." : "Welcome back."}</h1>
        <p className="mt-3 text-[16px] text-steel-dark">
          {forBag
            ? "We send a code to your phone so the order is yours. Your bag stays as it is."
            : signup
              ? "One account for the website and the store."
              : "Log in to see your orders and saved size."}
        </p>

        <div className="mt-8">
          {error && (
            <p role="alert" className="mb-5 rounded-xl bg-mist/60 px-4 py-3 text-[14px]">
              {error}
            </p>
          )}
          <LoginPanel next={next} channels={codeChannels()} providers={{ google: isConfigured("google"), facebook: isConfigured("facebook") }} />
        </div>

        <p className="mt-6 text-[15px]">
          {signup ? "Already have an account? " : "New here? "}
          <Link
            href={`/${signup ? "login" : "signup"}${next !== "/account" ? `?next=${encodeURIComponent(next)}` : ""}`}
            className="font-semibold underline underline-offset-4"
          >
            {signup ? "Log in" : "Create an account"}
          </Link>
        </p>
        <p className="mt-8 border-t border-ink/10 pt-5 text-[12.5px] leading-relaxed text-steel-dark">
          No account needed for Buy now or gifts. By continuing you agree to our{" "}
          <Link href="/terms" className="underline underline-offset-2">
            terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline underline-offset-2">
            privacy notice
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
