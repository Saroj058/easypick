"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useEffect } from "react";

import { AskWhatsApp } from "@/components/ask-whatsapp";
import { site } from "@/lib/site";

/** Something broke while loading a page (e.g. the database didn't answer). */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="container-ep max-w-xl py-24">
      <p className="text-sm font-semibold text-steel-dark">Something went wrong</p>
      <h1 className="display mt-3 text-[40px] md:text-[64px]">Give it a second.</h1>
      <p className="mt-4 text-lg text-steel-dark">
        We couldn&apos;t load this page. Your bag and any payment are safe. Try again, and if it keeps happening, message us.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <button
          type="button"
          // Refetch the page from the server too, not just re-render what already failed.
          onClick={() =>
            startTransition(() => {
              router.refresh();
              reset();
            })
          }
          className="btn btn-volt"
        >
          Try again
        </button>
        <Link href="/" className="btn btn-outline">
          Home
        </Link>
      </div>
      {site.store.whatsapp && (
        <AskWhatsApp
          className="mt-4"
          label="Message us on WhatsApp"
          text={`Hi Easypick, a page didn't load for me${error.digest ? ` (ref ${error.digest})` : ""}: `}
        />
      )}
      {error.digest && <p className="mt-6 font-mono text-[12px] text-steel-dark">Ref {error.digest}</p>}
    </div>
  );
}
