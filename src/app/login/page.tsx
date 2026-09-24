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
  const error = typeof sp.error === "string" ? errors[sp.error] : undefined;

  return (
    <div className="container-ep max-w-md pb-24 pt-12 text-center md:pt-20">
      <h1 className="display display-h1">{signup ? "Join Easypick." : "Welcome back."}</h1>
      <p className="mt-3 text-lg text-steel-dark">{signup ? "One account for the website and the store." : "Log in to see your orders and saved size."}</p>

      <div className="mt-10 text-left">
        {error && (
          <p role="alert" className="mb-6 bg-photo px-4 py-3 text-[14px]">
            {error}
          </p>
        )}
        <LoginPanel next={next} channels={codeChannels()} providers={{ google: isConfigured("google"), facebook: isConfigured("facebook") }} />
      </div>

      <p className="mt-8 text-[15px]">
        {signup ? "Already have an account? " : "New here? "}
        <Link
          href={`/${signup ? "login" : "signup"}${next !== "/account" ? `?next=${encodeURIComponent(next)}` : ""}`}
          className="font-semibold underline underline-offset-2"
        >
          {signup ? "Log in" : "Create an account"}
        </Link>
      </p>
      <p className="mt-6 text-[13px] text-steel-dark">
        You don&apos;t need an account to shop. By continuing you agree to our{" "}
        <Link href="/terms" className="underline">
          terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="underline">
          privacy notice
        </Link>
        .
      </p>
    </div>
  );
}
