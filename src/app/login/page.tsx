import type { Metadata } from "next";
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
    <div className="container-ep pb-24 pt-10 md:pt-16">
      {/* One calm column, no photos (owner, 15 Oct 2026). */}
      <div className="mx-auto flex w-full max-w-[420px] flex-col">
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
