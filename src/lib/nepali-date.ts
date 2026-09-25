import NepaliDate from "nepali-date-converter";

// Bikram Sambat (BS) dates next to AD ones: salaries, festivals and courier
// schedules in Nepal run on BS. Dates are read in Kathmandu time.

const MONTHS = ["Baisakh", "Jestha", "Asar", "Shrawan", "Bhadra", "Asoj", "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra"];

const ktmDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kathmandu" });

function toBS(date: Date) {
  // Midday on the Kathmandu calendar day, so the conversion never slips a day.
  const nd = new NepaliDate(new Date(`${ktmDay.format(date)}T12:00:00`));
  return { year: nd.getYear(), month: nd.getMonth(), day: nd.getDate() };
}

/** "Asoj 9", or "Asoj 9, 2083" with `withYear`. */
export function formatBS(date: Date, withYear = false) {
  const { year, month, day } = toBS(date);
  return `${MONTHS[month]} ${day}${withYear ? `, ${year}` : ""}`;
}
