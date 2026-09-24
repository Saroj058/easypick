import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ProfileForm } from "@/components/profile-form";
import { getCurrentUser, safeNext } from "@/lib/auth";

export const metadata: Metadata = { title: "Welcome", robots: { index: false } };

/** First step after signing up: what to call you, optional email, drop alerts. */
export default async function WelcomePage({ searchParams }: PageProps<"/login/welcome">) {
  const user = await getCurrentUser();
  const next = safeNext((await searchParams).next);
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);

  return (
    <div className="container-ep max-w-xl pb-24 pt-10 md:pt-16">
      <h1 className="display display-h1">Namaste.</h1>
      <p className="mt-4 text-lg text-steel-dark">One last thing. What should we call you?</p>
      <div className="mt-10">
        <ProfileForm mode="welcome" next={next} user={{ name: user.name, email: user.email, alerts: user.alerts, phone: user.phone, contactPhone: user.contactPhone ?? null }} />
      </div>
    </div>
  );
}
