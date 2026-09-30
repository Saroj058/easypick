import type { Metadata } from "next";
import Link from "next/link";

import { MapOnTap } from "@/components/map-on-tap";
import { VisitHero } from "@/components/visit-hero";
import { getCurrentUser } from "@/lib/auth";
import { jsonLd } from "@/lib/json-ld";
import { formatBS } from "@/lib/nepali-date";
import { ordersFor } from "@/lib/orders";
import { site } from "@/lib/site";
import { getStoreInfo } from "@/lib/store-info";
import { DAY_NAMES, hourLabel, hoursOn, ktmNow, storeState, type StoreInfo } from "@/lib/store-state";
import { getDropTimeline, getProduct } from "@/lib/store";

const metadata: Metadata = {
  title: "Visit us",
  description: "Find Easypick in Kathmandu: open now or not, opening hours, directions by landmark, and how the self-checkout store works.",
  alternates: { canonical: "/visit" },
};
// Open or closed is worked out per visit, in Kathmandu time.
export const dynamic = "force-dynamic";

const stampFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kathmandu" });
const shortDay = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

const addDays = (ymd: string, n: number) => {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** "Order EP-1000214 · ready at counter": one true reason to come today, for a signed-in visitor. */
async function personalLine(): Promise<string | null> {
  try {
    const user = await getCurrentUser();
    if (!user) return null;
    const ready = (await ordersFor(user.id, user.phone ?? null)).find((o) => o.status === "ready_for_pickup");
    return ready ? `ORDER ${ready.number} · READY AT COUNTER` : null;
  } catch {
    return null; // never let this break the page
  }
}

function storeLd(info: StoreInfo) {
  // Google reads the hours and address from here. Only real details, only once the store is open.
  const byHours = new Map<string, string[]>();
  for (const h of info.hours) if (!h.closed) byHours.set(`${h.open}-${h.close}`, [...(byHours.get(`${h.open}-${h.close}`) ?? []), DAY_NAMES[h.day]]);
  return {
    "@context": "https://schema.org",
    "@type": "ClothingStore",
    name: site.name,
    url: `${site.url}/visit`,
    ...(info.address && { address: { "@type": "PostalAddress", streetAddress: info.address, addressLocality: info.area, addressCountry: "NP" } }),
    ...(info.geo && { geo: { "@type": "GeoCoordinates", latitude: info.geo.lat, longitude: info.geo.lng } }),
    ...(info.phone && { telephone: info.phone }),
    ...(info.mapUrl && { hasMap: info.mapUrl }),
    openingHoursSpecification: [...byHours].map(([k, days]) => ({ "@type": "OpeningHoursSpecification", dayOfWeek: days, opens: k.split("-")[0], closes: k.split("-")[1] })),
    ...(info.special.length && {
      specialOpeningHoursSpecification: info.special.map((s) => ({
        "@type": "OpeningHoursSpecification",
        validFrom: s.date,
        validThrough: s.date,
        opens: s.closed ? "00:00" : s.open,
        closes: s.closed ? "00:00" : s.close,
      })),
    }),
    paymentAccepted: "eSewa",
    priceRange: "Rs 999 – Rs 3,499",
  };
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="border-t border-mist py-12 md:grid md:grid-cols-[1fr_2fr] md:gap-12 md:py-16">
      <h2 id={id} className="display display-h2">
        {title}
      </h2>
      <div className="mt-6 md:mt-0">{children}</div>
    </section>
  );
}

export default async function VisitPage({ searchParams }: PageProps<"/visit">) {
  const sp = await searchParams;
  // ?preview=open: the page as it'll look once open, with sample details, for demos. Never indexed.
  const preview = sp.preview === "open";
  const [info, timeline, personal, tryProduct] = await Promise.all([
    getStoreInfo({ preview }),
    getDropTimeline(),
    personalLine(),
    typeof sp.try === "string" ? getProduct(sp.try) : Promise.resolve(null),
  ]);
  const now = new Date();
  const state = storeState(info, now, timeline.next?.releaseAt ?? timeline.current?.releaseAt ?? null);
  const today = ktmNow(now).date;
  const stamp = `${formatBS(now, true).toUpperCase()} · ${stampFmt.format(now).toUpperCase()}`;
  const coming = info.special.filter((s) => s.date >= today && s.date <= addDays(today, 45)).sort((a, b) => a.date.localeCompare(b.date));
  const directions = info.mapUrl ?? (info.geo ? `https://www.google.com/maps/search/?api=1&query=${info.geo.lat},${info.geo.lng}` : null);
  const soon = state.kind === "soon";

  const faq = [
    { q: "How do I pay?", a: "At the self-checkout kiosk: it lists your pieces and shows a QR. Scan it with eSewa. That's all you need to bring." },
    { q: "Can I try things on?", a: "Yes. Take a numbered token from the helper for the pieces you take into the fitting room." },
    { q: "What if I need help?", a: "Our helper is on the floor the whole time. Ask about sizes, or anything else." },
    { q: "Can I return or exchange in store?", a: "Yes, within 7 days, with the receipt and the tags still on. See returns and exchanges." },
    { q: "Can I collect an online order?", a: "Yes. Show your order number or the SMS at the counter. Pickup is free." },
    ...(info.parking ? [{ q: "Is there parking?", a: info.parking }] : []),
    ...(info.access ? [{ q: "Is the store accessible?", a: info.access }] : []),
  ];

  return (
    <>
      {!preview && info.opened && <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(storeLd(info))} />}
      {preview && (
        <p className="bg-volt px-4 py-2 text-center text-[14px] font-semibold text-ink">
          Preview: how this page looks once the store is open, with sample details. The public page is unchanged.
        </p>
      )}
      <VisitHero info={info} state={state} stamp={stamp} personal={personal} />

      <div className="container-ep pb-24">
        <div className="flex flex-wrap gap-x-6 gap-y-2 pt-6 text-[15px]">
          {directions && (
            <a href={directions} target="_blank" rel="noopener" className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
              Get directions
            </a>
          )}
          {info.whatsapp && (
            <a href={`https://wa.me/${info.whatsapp}`} target="_blank" rel="noopener" className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
              WhatsApp the helper
            </a>
          )}
        </div>

        {tryProduct && (
          <div className="mt-6 border-l-4 border-volt bg-photo p-5">
            <p className="font-semibold">Want to try the {tryProduct.name}?</p>
            <p className="mt-1 text-[15px] text-steel-dark">
              {soon ? "Once we open, it'll be on the rack. " : "It's on the rack in store. "}
              Check live sizes on the{" "}
              <Link href={`/product/${tryProduct.slug}`} className="underline">
                product page
              </Link>{" "}
              before you come.
            </p>
          </div>
        )}

        <div className="mt-8">
          <Section id="find-h" title="Find us.">
            <p className="text-xl font-semibold">{info.address ?? `${site.name}, ${info.area}`}</p>
            {info.landmark && <p className="mt-1 text-steel-dark">{info.landmark}</p>}
            {!info.address && <p className="mt-1 text-steel-dark">The exact address goes up here about four weeks before opening day.</p>}
            {directions && (
              <div className="mt-5 flex flex-wrap gap-3">
                <a href={directions} target="_blank" rel="noopener" className="btn btn-ink">
                  Open in Google Maps
                </a>
                {info.phone && (
                  <a href={`tel:${info.phone}`} className="btn btn-outline">
                    Call
                  </a>
                )}
              </div>
            )}
            {info.geo && (
              <div className="mt-6">
                <MapOnTap lat={info.geo.lat} lng={info.geo.lng} label={info.address ?? info.area} />
              </div>
            )}
            {(info.transport || info.parking || info.access) && (
              <dl className="mt-8 grid gap-5 sm:grid-cols-3">
                {info.transport && (
                  <div>
                    <dt className="text-sm font-semibold">By bus or tempo</dt>
                    <dd className="mt-1 text-[15px] text-steel-dark">{info.transport}</dd>
                  </div>
                )}
                {info.parking && (
                  <div>
                    <dt className="text-sm font-semibold">Parking</dt>
                    <dd className="mt-1 text-[15px] text-steel-dark">{info.parking}</dd>
                  </div>
                )}
                {info.access && (
                  <div>
                    <dt className="text-sm font-semibold">Access</dt>
                    <dd className="mt-1 text-[15px] text-steel-dark">{info.access}</dd>
                  </div>
                )}
              </dl>
            )}
          </Section>

          <Section id="hours-h" title={soon ? "Planned hours." : "Opening hours."}>
            <table className="w-full max-w-md text-[15px]">
              <caption className="sr-only">Opening hours, Kathmandu time</caption>
              <tbody>
                {[0, 1, 2, 3, 4, 5, 6].map((n) => {
                  const day = addDays(today, n);
                  const h = hoursOn(info, day);
                  const special = info.special.find((s) => s.date === day);
                  return (
                    <tr key={day} className={`border-b border-mist ${n === 0 ? "font-semibold" : ""}`} aria-current={n === 0 ? "date" : undefined}>
                      <th scope="row" className="py-3 text-left font-[inherit]">
                        {n === 0 ? "Today" : DAY_NAMES[new Date(`${day}T12:00:00Z`).getUTCDay()]}
                        {special?.note && <span className="ml-2 text-[13px] font-normal text-steel-dark">{special.note}</span>}
                      </th>
                      <td className="py-3 text-right font-mono">{h ? `${hourLabel(h.open)} – ${hourLabel(h.close)}` : "Closed"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {coming.length > 0 && (
              <div className="mt-6">
                <p className="text-sm font-semibold">Coming up</p>
                <ul className="mt-2 space-y-1 text-[15px] text-steel-dark">
                  {coming.map((s) => (
                    <li key={s.date}>
                      <span className="font-mono text-ink">{shortDay.format(new Date(`${s.date}T12:00:00Z`))}</span> · {s.closed ? "Closed" : `${hourLabel(s.open!)} – ${hourLabel(s.close!)}`}
                      {s.note ? ` · ${s.note}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="mt-4 text-[13px] text-steel-dark">Kathmandu time.</p>
          </Section>

          <Section id="how-h" title="How it works.">
            <ol className="grid gap-8 sm:grid-cols-3">
              {[
                ["01", "Pick it.", "Every tag shows the price and the measurements in cm. Nobody follows you around."],
                ["02", "Pay it.", "Drop your pieces at the kiosk. It lists them and shows a QR. Scan with eSewa."],
                ["03", "Wear it.", "Your bill comes by SMS. Walk out. That's it."],
              ].map(([n, t, d]) => (
                <li key={n}>
                  <p className="font-mono text-[13px] text-steel-dark">{n}</p>
                  <p className="display mt-1 text-[32px] leading-none">{t}</p>
                  <p className="mt-2 text-steel-dark">{d}</p>
                </li>
              ))}
            </ol>
            <p className="mt-6 text-[15px]">
              Need help? Our helper is on the floor.{" "}
              <Link href="/how-it-works" className="font-semibold underline underline-offset-2">
                More on how it works
              </Link>
            </p>
          </Section>

          <Section id="plan-h" title="Plan your visit.">
            <ul className="grid gap-4 sm:grid-cols-2">
              <li className="bg-photo p-5">
                <p className="font-semibold">Check your size first</p>
                <p className="mt-1 text-[15px] text-steel-dark">Every product page shows live stock by size, so you know it&apos;s on the rack before you come.</p>
                <Link href="/shop" className="mt-3 inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
                  Shop
                </Link>
              </li>
              <li className="bg-photo p-5">
                <p className="font-semibold">Pick up an online order</p>
                <p className="mt-1 text-[15px] text-steel-dark">Order online, choose free pickup, and bring your order number or the SMS.</p>
                <Link href="/track" className="mt-3 inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
                  Track an order
                </Link>
              </li>
            </ul>
          </Section>

          {(info.whatsapp || info.phone || info.email || info.instagram) && (
            <Section id="contact-h" title="Contact.">
              <ul className="space-y-3 text-[17px]">
                {info.whatsapp && (
                  <li>
                    WhatsApp:{" "}
                    <a href={`https://wa.me/${info.whatsapp}`} target="_blank" rel="noopener" className="font-semibold underline underline-offset-2">
                      Message the helper
                    </a>
                  </li>
                )}
                {info.phone && (
                  <li>
                    Phone:{" "}
                    <a href={`tel:${info.phone}`} className="font-mono font-semibold underline underline-offset-2">
                      {info.phone}
                    </a>
                  </li>
                )}
                {info.email && (
                  <li>
                    Email:{" "}
                    <a href={`mailto:${info.email}`} className="font-semibold underline underline-offset-2">
                      {info.email}
                    </a>
                  </li>
                )}
                {info.instagram && (
                  <li>
                    Instagram:{" "}
                    <a href={info.instagram} target="_blank" rel="noopener" className="font-semibold underline underline-offset-2">
                      {info.instagram.replace(/^https?:\/\/(www\.)?instagram\.com\//, "@").replace(/\/$/, "")}
                    </a>
                  </li>
                )}
              </ul>
              <p className="mt-3 text-[14px] text-steel-dark">We reply during opening hours.</p>
            </Section>
          )}

          <Section id="faq-h" title="Questions.">
            <div className="divide-y divide-mist border-y border-mist">
              {faq.map(({ q, a }) => (
                <details key={q} className="group py-4">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                    {q}
                    <span className="text-xl leading-none transition-transform group-open:rotate-45" aria-hidden>
                      +
                    </span>
                  </summary>
                  <p className="mt-2 text-steel-dark">{a}</p>
                </details>
              ))}
            </div>
          </Section>

          <Section id="biz-h" title="The business.">
            <dl className="space-y-2 text-[15px]">
              <div>
                <dt className="inline font-semibold">Company: </dt>
                <dd className="inline">{site.company.legalName}</dd>
              </div>
              {site.company.panVat && (
                <div>
                  <dt className="inline font-semibold">PAN/VAT: </dt>
                  <dd className="inline font-mono">{site.company.panVat}</dd>
                </div>
              )}
              <div>
                <dt className="inline font-semibold">Address: </dt>
                <dd className="inline">{info.address ?? `${info.area}, Nepal`}</dd>
              </div>
            </dl>
          </Section>
        </div>
      </div>
    </>
  );
}

export async function generateMetadata({ searchParams }: PageProps<"/visit">): Promise<Metadata> {
  return (await searchParams).preview ? { ...metadata, robots: { index: false, follow: false } } : metadata;
}
