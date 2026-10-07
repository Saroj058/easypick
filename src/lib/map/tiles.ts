// Where the Find us map's tiles are, and the few numbers about them that the page needs before
// the map library is loaded (so this file imports nothing).

/** The Kathmandu extract in Supabase Storage (docs/VISIT_PAGE_PLAN.md, Phase 3a). Dated, so a new build is a new file. */
export const TILES_URL = "https://dfhbezpxijxoqpompiku.supabase.co/storage/v1/object/public/map/kathmandu-20261007.pmtiles";
/** A few zoom-14 tiles round the sample pin, for tests: never the real file in CI. */
export const FIXTURE_TILES_URL = "/map/fixture.pmtiles";
export const ATTRIBUTION = '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap</a> · <a href="https://protomaps.com" target="_blank" rel="noopener">Protomaps</a>';
/** The whole valley: what "pull out" shows. [[west, south], [east, north]] */
export const VALLEY: [[number, number], [number, number]] = [
  [85.2, 27.61],
  [85.5, 27.79],
];

/** The zoom the map starts at when it takes over from the 3D camera looking straight down. */
export const START_ZOOM = 19;
/** The middle of Jhamsikhel, for the "coming soon" map: the area is public, the address isn't yet. [lng, lat] */
export const AREA_CENTRE: [number, number] = [85.3075, 27.679];
/** How long a visit counts as "seen before" (the shorter repeat sequence): 30 days. */
export const SEEN_KEY = "ep.visit.seen";
export const SEEN_MS = 30 * 24 * 60 * 60 * 1000;
