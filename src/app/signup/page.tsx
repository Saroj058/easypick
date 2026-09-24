import { redirect } from "next/navigation";

import { safeNext } from "@/lib/auth";

/** Sign-up and log-in are one flow; this just opens it with sign-up wording. */
export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const next = safeNext((await searchParams).next);
  redirect(`/login?mode=signup${next !== "/account" ? `&next=${encodeURIComponent(next)}` : ""}`);
}
