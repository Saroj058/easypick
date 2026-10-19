import Link from "next/link";

/**
 * Buying for someone, as one quiet line (owner, 19 Oct 2026: "too big; make it small and put it
 * somewhere else"): it sits with Track an order at the foot of the home page, since the header
 * already links to Gift. The title, the line, and the two ways in.
 */
export function GiftBlock({ copy = { title: "Buying for someone?", line: "You pick the piece. They pick the size. We wrap it and bring it.", send: "Send a gift", cards: "Gift cards" } }: { /** Set in Admin → Home page. */ copy?: { title: string; line: string; send: string; cards: string } }) {
  const link = "inline-flex min-h-11 items-center text-[13.5px] font-semibold underline-offset-4 hover:underline";
  return (
    <section aria-labelledby="gift-title" className="border-t border-mist py-3 md:py-4">
      <div className="container-ep flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <p className="min-w-0 text-[13px] text-steel-dark">
          <span id="gift-title" role="heading" aria-level={2} className="mr-2 text-[15px] font-bold text-ink">
            {copy.title}
          </span>
          {copy.line}
        </p>
        <div className="flex shrink-0 items-center gap-5">
          <Link href="/gift" className={link}>
            {copy.send} <span aria-hidden className="ml-1">→</span>
          </Link>
          <Link href="/gift#buy" className={`${link} text-steel-dark hover:text-ink`}>
            {copy.cards}
          </Link>
        </div>
      </div>
    </section>
  );
}
