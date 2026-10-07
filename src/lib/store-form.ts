import { DAY_NAMES, toMinutes, type SpecialDay, type StoreInfo } from "./store-state";

// Reads the /admin/store form into StoreInfo. Pure, so it's easy to test.

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export type StoreFormResult = { ok: true; info: StoreInfo } | { ok: false; message: string };

/**
 * `previous` is what's saved now: fields this form doesn't edit (start points, parking spots,
 * the entrance photo) are carried over from it, so a save never wipes them.
 */
export function parseStoreForm(form: FormData, previous?: Pick<StoreInfo, "startPoints" | "parkingSpots" | "entrancePhoto">): StoreFormResult {
  const str = (k: string, max = 200) => String(form.get(k) ?? "").trim().slice(0, max);
  const opt = (k: string, max = 200) => str(k, max) || null;
  const all = (k: string) => form.getAll(k).map((v) => String(v).trim());
  const fail = (message: string): StoreFormResult => ({ ok: false, message });

  const openingDate = opt("openingDate", 10);
  if (openingDate && !DAY.test(openingDate)) return fail("Pick the opening day from the calendar.");

  const hours = DAY_NAMES.map((name, day) => ({ name, day, open: str(`open-${day}`, 5), close: str(`close-${day}`, 5), closed: form.get(`closed-${day}`) === "on" }));
  for (const h of hours) {
    if (h.closed) continue;
    if (!TIME.test(h.open) || !TIME.test(h.close)) return fail(`Set opening and closing times for ${h.name}, or tick Closed.`);
    if (toMinutes(h.close) <= toMinutes(h.open)) return fail(`${h.name}: closing time has to be after opening time.`);
  }

  const dates = all("sDate");
  const kinds = all("sKind");
  const opens = all("sOpen");
  const closes = all("sClose");
  const notes = all("sNote");
  const special: SpecialDay[] = [];
  for (let i = 0; i < dates.length; i++) {
    const date = dates[i];
    const note = (notes[i] ?? "").slice(0, 80);
    if (!date && !note) continue; // empty row
    if (!DAY.test(date)) return fail("Pick a date for every special day, or remove the row.");
    if (special.some((s) => s.date === date)) return fail(`${date} is listed twice.`);
    const closed = kinds[i] !== "hours";
    if (!closed) {
      if (!TIME.test(opens[i] ?? "") || !TIME.test(closes[i] ?? "")) return fail(`Set the hours for ${date}, or mark it closed.`);
      if (toMinutes(closes[i]) <= toMinutes(opens[i])) return fail(`${date}: closing time has to be after opening time.`);
    }
    special.push({ date, closed, ...(closed ? {} : { open: opens[i], close: closes[i] }), note });
  }
  if (special.length > 60) return fail("Keep it to 60 special days.");
  special.sort((a, b) => a.date.localeCompare(b.date));

  const texts = all("rText");
  const mins = all("rMin");
  const route = texts
    .map((text, i) => ({ text: text.slice(0, 40), minutes: Math.round(Number(mins[i])) }))
    .filter((r) => r.text);
  if (route.length > 6) return fail("Keep the route to 6 steps.");
  if (route.some((r) => !Number.isFinite(r.minutes) || r.minutes < 0 || r.minutes > 60)) return fail("Walking minutes go from 0 to 60.");

  const mapUrl = opt("mapUrl", 400);
  if (mapUrl && !/^https:\/\//.test(mapUrl)) return fail("The map link should start with https://");
  const instagram = opt("instagram", 200);
  if (instagram && !/^https:\/\//.test(instagram)) return fail("The Instagram link should start with https://");
  const email = opt("email", 120);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return fail("Check the email address.");
  const whatsapp = str("whatsapp", 20).replace(/\D/g, "") || null;
  if (whatsapp && !/^\d{10,15}$/.test(whatsapp)) return fail("WhatsApp: digits with the country code, like 9779800000000.");
  const phone = opt("phone", 20);
  if (phone && !/^[+\d][\d\s-]{6,18}$/.test(phone)) return fail("Check the phone number.");

  const lat = str("lat", 20);
  const lng = str("lng", 20);
  let geo: StoreInfo["geo"] = null;
  if (lat || lng) {
    const la = Number(lat);
    const ln = Number(lng);
    // Nepal, roughly: keeps a swapped or mistyped pin off the map.
    if (!(la > 26 && la < 31 && ln > 80 && ln < 89)) return fail("The map pin should be in Nepal: latitude about 27.7, longitude about 85.3.");
    geo = { lat: la, lng: ln };
  }

  const opened = form.get("opened") === "on";
  const address = opt("address", 160);
  if (opened && !address) return fail("Add the address before switching the store to Open.");

  return {
    ok: true,
    info: {
      opened,
      openingDate,
      area: str("area", 80) || "Kathmandu",
      address,
      landmark: opt("landmark", 120),
      mapUrl,
      geo,
      phone,
      whatsapp,
      email,
      instagram,
      hours: hours.map(({ day, open, close, closed }) => ({ day, open: closed ? open || "11:00" : open, close: closed ? close || "20:00" : close, closed })),
      special,
      notice: str("notice", 120),
      route,
      startPoints: previous?.startPoints ?? [],
      entrancePhoto: previous?.entrancePhoto ?? null,
      parkingSpots: previous?.parkingSpots ?? [],
      transport: str("transport", 200),
      parking: str("parking", 200),
      access: str("access", 200),
    },
  };
}
