import type { Metadata } from "next";
import Link from "next/link";

import { PageIntro } from "@/components/page-intro";
import { unsubscribeFromDrops } from "@/lib/drop-alerts";

export const metadata: Metadata = { title: "Stop drop alerts", robots: { index: false } };

// The link in every drop message. Stopping takes a button press, so a mail scanner
// opening the link doesn't unsubscribe anyone by accident.
export default async function StopAlertsPage({ searchParams }: PageProps<"/alerts/stop">) {
  const sp = await searchParams;
  const token = typeof sp.t === "string" ? sp.t : "";
  const done = sp.done === "1";
  const missing = sp.done === "0";

  async function stop() {
    "use server";
    const ok = token ? await unsubscribeFromDrops(token) : false;
    const { redirect } = await import("next/navigation");
    redirect(`/alerts/stop?done=${ok ? 1 : 0}`);
  }

  return (
    <>
      <PageIntro
        title={done ? "Stopped." : "Stop drop alerts?"}
        lead={
          done
            ? "You won't get any more drop messages from us."
            : missing || !token
              ? "That link doesn't match a sign-up. It may already be stopped."
              : "You'll stop getting a message on drop days. You can sign up again any time."
        }
      />
      <div className="container-ep pb-24">
        {!done && !missing && token ? (
          <form action={stop}>
            <button type="submit" className="btn btn-ink">
              Stop the messages
            </button>
          </form>
        ) : (
          <Link href="/" className="btn btn-outline">
            Back to the shop
          </Link>
        )}
      </div>
    </>
  );
}
