import Link from "next/link";

import { AlertSignup } from "@/components/alert-signup";
import { formatPrice } from "@/lib/format";
import { site, walletList } from "@/lib/site";

import { FadeUp, MaskLines } from "./reveal";
import { L } from "./tokens";

// The Vault's last two sections: trying a piece on in the store, then the Vault list sign-up.
// Only true store facts here (owner, 25 Oct 2026: no invented claims).

/** A link whose underline draws in from the left on hover or focus; a faint hairline sits under it at rest. */
function DrawLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`group relative inline-block pb-1 ${L.ivory} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ede8df]`}
    >
      {children}
      <span aria-hidden className="absolute inset-x-0 bottom-0 h-px bg-[#ede8df]/30" />
      <span
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-px origin-left scale-x-0 bg-[#ede8df] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-x-100 group-focus-visible:scale-x-100 motion-reduce:transition-none"
      />
    </Link>
  );
}

/** Section 8: try it on in store. The address shows once the lease is signed (site.store.address). */
export function TryInStore() {
  const address = site.store.address;
  // The Vault's own rule from the blueprint (section 15): 7-day size exchange with tags on; pairs unworn, box undamaged.
  const facts = [`Pay with ${walletList()}`, `Free delivery over ${formatPrice(site.delivery.freeAbove)}`, "Size exchange within 7 days, unworn, tags on", "Pairs: box undamaged"];

  return (
    <section aria-labelledby="vault-store" className={`${L.section} ${L.ivory}`}>
      <div className={`${L.wrap} grid gap-12 md:grid-cols-12 md:gap-10`}>
        <div className="md:col-span-6">
          {/* MaskLines can't take an id, so the real heading is read out and the moving copy is hidden from screen readers. */}
          <h2 id="vault-store" className="sr-only">
            Try it on, in store.
          </h2>
          <div aria-hidden>
            <MaskLines as="p" lines={["Try it on, in store."]} className={`${L.serif} text-[44px] leading-[0.92] md:text-[72px]`} />
          </div>
          <FadeUp delay={0.15} className="mt-8 max-w-[52ch]">
            <p className={`text-[16px] leading-[1.5] ${L.dim}`}>
              {address ? <>Every Vault piece can be tried on at {address}, {site.store.area}.</> : <>Our {site.store.area} store opens soon. Every Vault piece can be tried on there.</>}
            </p>
            <p className="mt-6 text-[15px]">
              <DrawLink href="/visit">Plan a visit</DrawLink>
            </p>
          </FadeUp>
        </div>
        <FadeUp delay={0.25} className="md:col-span-5 md:col-start-8 md:self-end">
          <ul className={`border-t ${L.hair}`}>
            {facts.map((f) => (
              <li key={f} className={`border-b ${L.hair} py-4 ${L.label} tabular-nums ${L.dim}`}>
                {f}
              </li>
            ))}
          </ul>
        </FadeUp>
      </div>
    </section>
  );
}

/** Section 9: the Vault list. Title (up to 60 chars) and note (up to 160) come from Admin → The Vault. */
export function VaultList({ title, note }: { title: string; note: string }) {
  return (
    <section aria-labelledby="vault-list" className={`${L.section} ${L.ivory}`}>
      <div className={L.wrap}>
        {/* The one brass hairline: this is the page's main call to action. */}
        <div aria-hidden className={`h-px w-full max-w-[960px] ${L.brassBg} opacity-60`} />
        <div className="max-w-[960px] pt-16 md:pt-28">
          <h2 id="vault-list" className="sr-only">
            {title}
          </h2>
          <div aria-hidden>
            <MaskLines as="p" lines={[title]} className={`${L.serif} max-w-[18ch] text-[44px] leading-[0.92] [overflow-wrap:anywhere] md:text-[88px]`} />
          </div>
          <FadeUp delay={0.15} className="mt-10 md:mt-14">
            <div className="[&_[role=status]]:text-[#ede8df]">
              <AlertSignup source="vault" lux note={note} done="You're in. We'll message {to} when a new piece lands." />
            </div>
          </FadeUp>
        </div>
      </div>
    </section>
  );
}
