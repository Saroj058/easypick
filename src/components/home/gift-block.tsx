import Link from "next/link";

/**
 * Buying for someone, as just a button (owner, 27 Oct 2026: "the home story already tells about
 * gifts; just a button to gift"). The title stays for screen readers; the line and gift cards are
 * on the Gift page.
 */
export function GiftBlock({ copy = { title: "Buying for someone?", line: "You pick the piece. They pick the size. We wrap it and bring it.", send: "Send a gift", cards: "Gift cards" } }: { /** Set in Admin → Home page. */ copy?: { title: string; line: string; send: string; cards: string } }) {
  return (
    <section aria-labelledby="gift-title" className="border-t border-mist py-4 md:py-5">
      <div className="container-ep flex justify-center">
        <h2 id="gift-title" className="sr-only">
          {copy.title}
        </h2>
        <Link href="/gift" className="inline-flex h-11 items-center gap-2 rounded-full border border-ink px-6 text-[14px] font-semibold transition-colors hover:bg-ink hover:text-paper">
          {copy.send} <span aria-hidden>→</span>
        </Link>
      </div>
    </section>
  );
}
