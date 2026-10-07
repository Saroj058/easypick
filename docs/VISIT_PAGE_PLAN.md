# Visit page build plan v2: "One Camera" + motion map

Owner: Saroj · v2, 7 October 2026 · Built in this repo with Claude Code.
v2 is v1 reviewed by five specialists (architecture, motion, performance and accessibility, map data and security, Claude Code workflow) and checked against the actual code.
Prototype to match: the "Easypick Visit" motion artifact. Product context: `docs/BLUEPRINT.md`.

**For Claude Code:** do one phase per session, in order. Read §0, §8 and §9 before every phase. Read `node_modules/next/dist/docs/` before using any Next.js API (AGENTS.md). Start in plan mode and wait for Saroj's OK.

---

## 0. Progress tracker (Claude Code updates this at the end of every session)

| Phase | Branch | PR | Status | Date | Notes / blockers |
| --- | --- | --- | --- | --- | --- |
| 0 Setup | visit/phase-0 | | review | 7 Oct 2026 | `docs/BLUEPRINT.md` stays local and git-ignored (public repo; section 21 has business figures), so only this plan is committed. No GitHub CLI here: Claude pushes the branch and Saroj opens the PR from the compare link |
| 1a Data + pure logic | visit/phase-1a | | review | 7 Oct 2026 | Stacked on phase-0. Gaps over 150 m are checked on the pasted trace (simplifying a straight street leaves long legs on purpose). Until 1b, `parseStoreForm` carries start points, parking and the photo over from what's saved. Gate: 174 unit, build, 41 e2e (2 workers) |
| 1b Admin start points | visit/phase-1b | | review | 7 Oct 2026 | Stacked on 1a. Steps and parking are one-line-per-entry text boxes; the form marks itself (`startPointsForm`) so an older form keeps what's saved. Simplify keeps legs ≤ 140 m so a saved route pastes back in. Preview is the SVG stand-in in `find-us-map.tsx`. Gate: 179 unit, build, 42 e2e (2 workers) |
| 2a Stage, status, links (no 3D) | visit/phase-2a | | review | 7 Oct 2026 | Stacked on 1b. Poster is two stills of the existing 3D store (shutter up / down), AVIF at 828 and 1656 wide (9 KB and 17 KB). Before opening the whole page is stripped of address, pin, map link, routes, parking and photo, not only the client props. The old link row (tour, directions) went: the hero has both. Gate: 181 unit, build, 45 e2e (2 workers) |
| 2b Night store 3D | visit/phase-2b | | review | 7 Oct 2026 | Stacked on 2a. GPU tiers are a small check (touch screen or under 768 px wide = tier 2; Save-Data, slow network, low memory or no WebGL = poster only) instead of `detect-gpu`, so no benchmark data to host: say if you want the library. Four lights (sky, moon, room, shopfront). The 3D spec is `e2e/visit-3d.spec.ts`; the 3D projects now run one worker at a time (two software-rendered specs side by side timed out). Gate: 181 unit, build, 49 e2e |
| 3a Map tiles + fonts | visit/phase-3a | | review | 7 Oct 2026 | `kathmandu-20261007.pmtiles`, 12.7 MB (valley z0–13 4.6 MB + Ring Road and Patan z14–15 8.1 MB), merged with `pmtiles merge` (no tile-join on Windows), verified. Uploaded with Saroj's OK to the public Supabase bucket `map`: https://dfhbezpxijxoqpompiku.supabase.co/storage/v1/object/public/map/kathmandu-20261007.pmtiles. Range check: `206`, `Content-Range: bytes 0-16383/12671516`, `Access-Control-Allow-Origin: *`, preflight allows `range`. **Cache header:** stored as `max-age=31536000` but Supabase serves `Cache-Control: no-cache` with an ETag, so browsers revalidate (cheap 304s); `immutable` isn't available here, R2 would give it. Fonts (735 KB) and a 70 KB `fixture.pmtiles` (z14 round the sample pin) are committed; the build copy is in `D:easypick_maptiles`, outside the repo |
| 3b Map + style + CSP | visit/phase-3b | | review | 7 Oct 2026 | Stacked on 3a. Stricter CSP option taken: MapLibre 6's worker is our own copy at `public/map/maplibre-gl-worker.mjs` (a unit test fails if it drifts from the installed version), so `worker-src 'self'` with no `blob:`. `connect-src` gains the tiles' Supabase origin. A third font, Noto Sans Devanagari Regular v1 (the basemap's Nepali glyphs), is hosted too: fonts are 1.5 MB in all. The admin's flat route drawing moved to `route-preview.tsx` so `/admin` doesn't load the map library. Build proof: `/visit` has 7 entry scripts (166 KB gzip); the MapLibre chunk (294 KB gzip) and the three chunk (245 KB) are not among them. Gate: 183 unit, build, 52 e2e |
| 4 Motion sequence | visit/phase-4 | | review | 7 Oct 2026 | Stacked on 3b. Order of the hand-over: the 3D camera rises to straight overhead (as high as map zoom 19), its last frame is kept as a picture, the canvas goes, then the map is made at the same spot and fades in over the picture; the map's phases run from `mapPhases()` in `sequence.ts`. So the crossfade starts when the map is ready (about 0.7 s plus load), not at a fixed 0.56 s, because of the one-context rule. Not done: the camera does not follow the head of the line while it draws (the whole route is already in view). The panel is `directions.tsx` in its basic form; chips, travel modes, the arrival card and the phone sheet's snap points are Phase 5. No normal-speed video was recorded: software rendering here runs far slower than a phone, so it would mislead; stills are in `test-results/shots/visit-4-*`. Gate: 186 unit, build, 56 e2e |
| 5 Directions + arrival | visit/phase-5 | | review | 7 Oct 2026 | Stacked on 4. The panel is one component: a side panel from 768 px, a bottom sheet below (96 px peek, half, 92 %; it opens at half; drag the handle or tap it). The peek always shows the total and Google Maps. Minutes: the total comes from the route's length at 75 / 280 / 360 m a minute, and each receipt line shows its share of that total, so the last line and the total always agree (the page section further down still prints the minutes as typed in admin). Bike opens Google Maps in driving mode (it has no bike directions here). Copy address falls back to the old copy command, and if that fails too it says to press and hold the address. An entrance photo that fails to load (the CSP only allows our own and Supabase images) hides itself. One existing test changed its data, not its meaning: the admin special-day test now closes the day six days out instead of tomorrow, because "tomorrow" collided with the date the lights test pins the clock to when the suite ran on 7 Oct 2026. Review shots (not baselines, not committed): `test-results/shots/visit-5-*`. Gate: 186 unit, build, 58 e2e |
| 6 Step inside + fallbacks + a11y | visit/phase-6 | | review | 7 Oct 2026 | Stacked on 5. **Step inside:** the door opens and the camera goes through; the hand-over happens when the push is 950/1100 of the way (by progress, not a timer, so a slow phone still arrives inside), its frame is kept for this tab only and the tour shows it while loading; with no frame the tour shows `door-poster.avif` (11 KB). The link's own address stays `/visit/tour` (it works with no JavaScript); with JavaScript it goes to `#enter`. Back shows the door closing. The tour's end has Get directions. **Fallbacks:** light version = poster + receipt + `route-static.avif` (16 KB, the sample route, credit printed on it; it is only shown while the store's pin matches the pin it was drawn for, otherwise the Google map on a tap); no WebGL = poster + receipt + the Google map on a tap; reduced motion = no door push, the map opens finished. If the live map loses its graphics context the page drops to the light version at the Find us section. **Accessibility:** Escape hands the keyboard back to Find us; receipt lines and the sheet handle are now 44 px; a test measures every target on the map screen. **axe was not added** (the plan says to ask first): waiting for Saroj's yes or no. **From my location:** the chip is offered only when `/visit` was loaded directly (the permission header belongs to the document, so after moving from another page of the site the browser would refuse; the chip is hidden then). One coarse reading on tap, a dashed straight line and the distance; the reading lives in component state only, and a test checks it reaches no address, storage or request. **Not built:** the optional sound toggle. Stills for review: `test-results/shots/visit-6-*`. Gate: 186 unit, build, 64 e2e |
| 7 Performance + launch | visit/phase-7 | | review | 7 Oct 2026 | Stacked on 6. Results, misses and the device checklist are in §11. Three small fixes, no features: the device check (which asks for a WebGL context) now waits until after the first paint; the map's code is fetched when Find us is pointed at, focused or pressed (not on the plan's 3-second timer: an existing test says nothing of the map loads before it's asked for, and a visitor who never opens the map shouldn't pay for it); the phone bar comes in at 0.7 s instead of 1.0 s. The last checklist line of Phase 7 (real pin, routes, photo, new still) waits for the lease. Gate: 186 unit, build, 64 e2e |

Status values: todo / doing / review / merged.

---

## 1. What we're building

`/visit` becomes one continuous scene:

1. **Hero:** the Easypick store as a lit 3D building at night. A big "Come in." heading and one status line (`OPEN · TILL 8 PM · JHAMSIKHEL`). The building's lights show open, closed, drop day or coming soon. Two choices: **Step inside** and **Find us**.
2. **Step inside:** the camera pushes through the glass door and hands over to the existing tour at `/visit/tour`, starting at the entrance. No black frame in between.
3. **Find us:** the camera rises until it looks straight down, then becomes a full-screen dark map at exactly the same spot. The map pulls out to show the whole valley, flies to the route, draws it in lime, and the directions panel slides in. Useful information (walk time + Google Maps) is on screen within about 1.2 s; the whole sequence takes about 5.6 s on a first visit and can be skipped at any moment.
4. The page sections below the hero stay as they are.

The shutter hero is removed. The store is shown as open (with a real "coming soon" state for before February 2027).

## 2. What exists in the repo (verified)

| Area | File / function | Notes for this build |
| --- | --- | --- |
| Visit page | `src/app/visit/page.tsx` (`force-dynamic`, `?preview=open`, noindexed via `generateMetadata`) | Replace the hero, keep the sections |
| Current hero | `src/components/visit-hero.tsx` | Contains the "Coming soon" `AlertSignup`/`Countdown` block. Move that into the new hero before deleting. Keep `Row`/`Rule` for the receipt |
| Store state | `src/lib/store-state.ts`: `storeState(info, now, dropAt)` returns `soon/open/drop/closed` + headline; `DEFAULT_STORE`; `withDefaults` (`{...DEFAULT_STORE, ...saved}` + a `fill` list for preview); `SAMPLE_STORE` (**has no `geo`**); `ktmNow`; `hourLabel` | Reuse; don't write a second state machine |
| Drop dates | `getDropTimeline()` | Source of `dropAt` |
| Store details | `src/lib/store-info.ts`: `getStoreInfo` with `unstable_cache` (key `store-info-v1`, tag `store-info`, 3600 s); `saveStore` → `updateTag` + `revalidatePath` | Bump key to `store-info-v2` when the shape changes |
| Form parsing | `src/lib/store-form.ts` `parseStoreForm` builds the whole `StoreInfo` from form fields | **Any field it doesn't parse is wiped on save.** New fields must be parsed here |
| Admin | `src/app/admin/(panel)/store/store-form.tsx`, `src/app/admin/store-actions.ts` | Add Start points |
| 3D model | `src/components/tour3d/build-store.ts` `buildStore({ fonts, tag, bill, logos })`; `apply(t)` drives the rolling shutter; glass front is fixed and the doors are modelled open; "lights" are mostly `glow()` `MeshBasicMaterial` (`toneMapped:false`) | Needs a sliding door mesh and `setNight(kind)`; see Phase 2b |
| Tour canvas | `src/components/tour3d/tour-canvas.tsx` with private `readFonts`, `fontsReady`, `loadLogos`, `storeEnvironment`; `onReady` poster pattern | Move the helpers to a shared file |
| Tour page | `src/app/visit/tour/page.tsx` (`revalidate = 300`, builds tag/bill props); `src/components/walk-tour.tsx` (scroll-driven, `decideMode()`, `reach()`, saveData/deviceMemory check) | Start-at-door must be read on the client |
| Status refresh | `src/components/refresh-at.tsx` | Refresh at next open/close time |
| Map today | `src/components/map-on-tap.tsx` (Google embed) | Kept as the no-WebGL fallback |
| Headers | `next.config.ts`: CSP has **no `worker-src`**; `connect-src 'self'` + Vercel; `Permissions-Policy: geolocation=()` | Must change (Phase 3b, Phase 6) |
| Tests | `e2e/visit.spec.ts` (asserts shutter, receipt, "Opening" h1, admin "Step 1"), `e2e/tour.spec.ts` (`data-tour-state`, `data-chapter`, console collector), `test/` (Vitest with embedded Postgres) | visit.spec must be **rewritten**, not just extended |
| CI | `.github/workflows/ci.yml` | The gate in §8 matches it |

## 3. Decisions (made; change only with Saroj)

| Topic | Decision |
| --- | --- |
| Map library | `maplibre-gl` (v6) + `pmtiles`, loaded only in the client stage with `next/dynamic({ ssr:false })` |
| Map data | Protomaps basemap extract (data stops at z15; MapLibre overzooms to z18). Valley at z≤13, full detail z15 only for Ring Road + Patan. Target ≤ 15 MB |
| Tile hosting | **Supabase Storage public bucket** (already in our stack), dated filename, `Cache-Control: public, max-age=31536000, immutable`. Never committed to git (public repo). Cloudflare R2 is the backup if egress gets high |
| Style | Built with `@protomaps/basemaps` (`layers("protomaps", {...namedFlavor("black"), ...ours})`) and our colours; no POIs, no sprite |
| Map labels | Noto Sans glyphs from protomaps basemaps-assets, self-hosted in `public/map/fonts/` (Inter glyphs don't exist ready-made). Labels only for places and major roads |
| Attribution | Visible "© OpenStreetMap · Protomaps", `AttributionControl({ compact:false })`; also printed on the static fallback image |
| Routes | Our own recorded/traced lines per start point, stored in the store `meta` JSON, edited in admin. No live routing at launch |
| Turn-by-turn | Plain `<a>` to Google Maps, no `origin` parameter |
| Hero 3D | R3F reusing `buildStore`, night look passed as props |
| WebGL contexts | Never two at once: snapshot the last 3D frame to an `<img>`, unmount the canvas, then create the map |
| Hand-off to tour | Client-side `#enter` hash on `/visit/tour` (the page stays ISR) |
| View Transitions | Optional extra only (experimental in Next 16). Default is a matched poster crossfade |
| Preview | `?preview=open` stays public but noindexed; it only ever shows sample data. `?now=` and `?motion=fast` work only with preview or outside production |

## 4. Target structure

```
src/app/visit/page.tsx                    server: data, state, status; renders <VisitStage> with HTML children
src/components/visit/visit-stage.tsx      client: state machine, the only place with next/dynamic(ssr:false)
src/components/visit/store-night.tsx      client: R3F canvas, night rig, door, orbit
src/components/visit/find-us-map.tsx      client: MapLibre map, sequence, route, pin (also used in admin preview)
src/components/visit/directions.tsx       client: chips, modes, receipt, arrival card
src/components/visit/shared-pin.tsx       client: one DOM lime pin that survives the 3D→map seam
src/components/tour3d/store-assets.ts     moved from tour-canvas: readFonts, fontsReady, loadLogos, storeEnvironment
src/lib/tour-props.ts                     moved from tour/page.tsx: getTourProps() (tag, bill) for both pages
src/lib/visit-status.ts                   pure: statusLine(state, info), lightsFor(state)
src/lib/map/route.ts                      pure: parse, simplify, length, pointAt, bounds, minutes, stepAt, snapToPin
src/lib/map/sequence.ts                   pure: the timing table, phaseAt(t, mode)
src/lib/map/style.ts                      MapLibre style
public/map/fonts/{fontstack}/{range}.pbf  glyphs
public/map/fixture.pmtiles                tiny test tiles (kilobytes)
public/visit/store-night.avif             hero poster (≤ 50 KB at 828w)
public/visit/door-poster.avif             last frame of the door push (tour loading poster)
public/visit/route-static.avif            static map fallback with attribution
```

## 5. Data model

In `src/lib/store-state.ts`:

```ts
export interface StartPoint {
  id: string;                    // ^[a-z0-9-]{1,24}$, e.g. "chowk"
  name: string;                  // ≤ 40 chars, "Jhamsikhel Chowk"
  coords: [number, number][];    // [lng, lat], 6 decimals, 2–300 points, last point = store pin
  steps: RouteStep[];            // ≤ 6, receipt lines
}
// StoreInfo gains:
startPoints: StartPoint[];       // ≤ 6, first = default
entrancePhoto: string | null;
parkingSpots: { kind: "bike" | "car"; lng: number; lat: number }[];
```

- Defaults go in `DEFAULT_STORE`; add the new keys **and `geo`** to the preview `fill` list.
- `SAMPLE_STORE` gets a sample `geo` and four sample start points, **shifted about 300 m from the real location and labelled "(sample)"**. The real coordinates never go in the repo before launch.
- The old `route` field stays. If `startPoints` is empty, the receipt shows `route` steps with no drawn line.
- Travel speeds (one constant): walk 75 m/min, bike 280, car 360. Google Maps link uses `walking` or `driving` (bike → driving).

**Route input pipeline (`route.ts`, unit-tested):**
1. Accept a GeoJSON LineString/Feature, GPX `<trkpt>`, or `lat,lng` lines. Max 200 KB of text, 5,000 raw points.
2. Fix swapped pairs: in Nepal latitude is 26–31 and longitude 80–89, so they can't be confused. Store `[lng, lat]`.
3. Simplify with Douglas-Peucker in metres, tolerance 3 m. Then 2–300 points.
4. Reject any jump over 150 m between points; total length 30 m–5 km.
5. Store pin must be set. Last point within 30 m of the pin → replaced by the exact pin; further → clear error.

**Privacy before opening:** when state is `soon`, the server strips `geo`, `startPoints`, `parkingSpots`, `address` and `entrancePhoto` before anything is passed to a client component (everything passed ends up in the HTML).

## 6. The motion sequence (source of truth for `sequence.ts`)

Easings: `inOut = cubic-bezier(.65,0,.35,1)`, `out = cubic-bezier(.22,1,.36,1)`, `quart = easeInOutQuart`.

**First visit (panel at ≈ 5.6 s):**

| Time | Camera | Screen |
| --- | --- | --- |
| 0–0.7 s | 3D camera rises to look straight down, bearing = map bearing (`inOut`) | The lime pin above the roof stays put |
| 0.56–0.8 s | Crossfade 3D snapshot → map, linear. Map starts at the zoom that matches the 3D camera (`mpp = 2·h·tan(fov/2)/viewportH`, `zoom = log2(156543·cos 27.68° / mpp)`, ≈ 19). Store footprint drawn flat | Same pin, now positioned with `map.project()` |
| 0.7–1.7 s | Pull out to the whole valley (`flyTo`, curve 1.42, `quart`) | "Find us." fades in (400 ms). From 1.0 s, phones show a 64 px bottom bar `3 MIN WALK · OPEN TILL 8 · Google Maps` |
| 1.7–2.3 s | Valley hold, 600 ms | Area names |
| 2.3–3.3 s | Fly to route bounds (`quart`) | Title fades |
| 3.3–~5.1 s | Route draws; duration `clamp(900 + 0.3 × metres, 1200, 2400)` ms; ease-in first 12 %, linear, ease-out last 15 %; camera follows the head with a critically damped spring (~280 ms) | Each receipt line lights as the line passes it (white text, 2 px lime tick slides in 180 ms) |
| ~5.1–5.6 s | Settle (expo-out) | Panel slides in: 520 ms, `out`, 24 px + opacity; map recentres over the same 520 ms |
| +0.7 s | Arrival: footprint extrudes 0→8 m, pitch 0→40° facing the storefront | Pin sends one ring 0→48 px; TOTAL line stamps (1.04→1, 160 ms); `navigator.vibrate(12)` on Android |

**Other entries:**
- **Repeat visit** (`localStorage` `ep.visit.seen`, 30 days, in try/catch): no valley. Rise 700 → straight to route bounds 900 → draw 1200–1800 → settle 400 ≈ 3.4 s.
- **Deep link `/visit#find-us`** (QR, Instagram): no 3D, open at route bounds, route drawn by 1.5 s.
- **Chip change:** old route retracts 250 ms, new one draws. No valley.
- **Soon state:** no route. Valley → 400 m circle around Jhamsikhel → opening-list sign-up. ≈ 3 s.
- **Map not ready:** camera keeps rising slowly up to 1.5 s, then fades to the map with the lime outline. Never a blank screen.

**Skip and interrupt (WCAG 2.2.2):**
- A visible `Skip ›` button (44 px) from 0 ms. Skip, a tap, Space, Enter or Esc jumps to the end state in ≤ 300 ms: route fully drawn, panel in.
- Drag or pinch stops the camera where the visitor put it, but the route is set to fully drawn and the panel still shows (fixes the prototype bug where the panel never appeared).
- No scroll-wheel trigger on the hero (it fights normal page scrolling).

**Hero micro-interactions:**
- Hover/press **Step inside**: door slides open 12 %, interior light +20 %, camera dollies 0.4 m in (600 ms).
- Hover/press **Find us**: camera tilts up 4°, pin drops above the roof (280 ms, slight overshoot).
- Both start prefetching their next step (`router.prefetch('/visit/tour')`, map chunk + valley tiles).
- Phones: preview on press, commit on release. Two 56 px buttons side by side, Find us on the right.
- No custom cursor.

**Step inside hand-off:** dolly through the door over 1100 ms (`cubic-bezier(.7,0,.3,1)`), door opens during the first 500 ms, navigate at 950 ms to `/visit/tour#enter`. The tour shows `door-poster.avif` (the exact last hero frame) while loading, then crossfades 200 ms. Back returns to the hero with the door closing (400 ms). Phones where `decideMode()` wouldn't give 3D skip the push and go straight to the tour.

**Bottom sheet (phones):** snap points 96 px peek (total time + Google Maps), 50 %, 92 %; swipe down to close; "← The store" in the sheet header.

**Sound:** off by default, header toggle, Web Audio, ≤ 30 KB total: a 700 ms air swell on the rise, a 30 ms printer tick per receipt line, a soft two-note arrival chime.

## 7. Performance and accessibility budgets

**JavaScript (min+gzip):** three ≈ 185 KB, R3F ≈ 57 KB, maplibre-gl v6 ≈ 287 KB (+10 KB CSS), pmtiles ≈ 8 KB.
- First load of `/visit` contains **no** three/maplibre chunk (check the build output).
- Hero chunk ≤ 250 KB, loaded after the poster and `requestIdleCallback`, only on GPU tier 2+.
- Map chunk ≤ 300 KB, prefetched on press/focus of Find us and after 3 s idle on the hero.

**Targets:**
| Metric | Target |
| --- | --- |
| LCP (poster), Lighthouse mobile | < 2.5 s |
| Poster | ≤ 50 KB AVIF, `fetchpriority="high"`, real `alt` |
| Map interactive after tap | ≤ 2 s prefetched, ≤ 4 s cold |
| Key info on screen | ≤ 1.2 s after Find us |
| Panel | ≤ 5.6 s first visit, 3.4 s repeat, 1.5 s deep link |
| Skip completes | ≤ 300 ms |
| Frame rate during fly | 30 fps p95 on a mid-range Android (logged, not a CI gate) |

**Low-end devices:**
- GPU tiers with `detect-gpu` (self-host its benchmark data via `benchmarksURL`; the CSP blocks unpkg). Tier 0–1: poster only. Tier 2: `dpr 1`, no shadows, no antialias. Tier 3: `dpr [1, 1.5]`. `powerPreference: "default"`.
- Max 4 dynamic lights; the shadow spot is replaced by a baked light texture on phones.
- `frameloop="demand"`; `invalidate()` only during orbit/door moves; `frameloop="never"` when the hero is off-screen or the tab is hidden.
- MapLibre `pixelRatio: Math.min(devicePixelRatio, 1.5)`; building extrusion only on tier 3.
- Context loss: on `webglcontextlost`, `preventDefault()` and show the poster; on restore, remount the canvas with a new `key`. Map context loss → static route image + receipt.
- Save-Data, 2G/3G or `deviceMemory ≤ 2` → lite mode (reuse the check in `walk-tour.tsx`).

**In-app browsers (Instagram, TikTok):** Google Maps and WhatsApp (`https://wa.me/?text=`) are plain `<a>` links, never `window.open` or `intent://`. Copy address falls back to `execCommand('copy')`, and the address is always selectable text. Geolocation `timeout: 10000`, on error show the Google Maps link.

**Accessibility:**
- Canvas `aria-hidden`; the h1 "Come in.", status line and both links are HTML.
- Map container: `role="region"`, `aria-label="Map: route from Jhamsikhel Chowk to Easypick"`.
- "Skip map, read directions" link; the receipt is in the DOM from the start.
- One `aria-live="polite"` message when the route is ready.
- When the panel opens, focus moves to its heading; Esc closes the sheet and returns focus.
- No arrow-key handling on the hero (Tab is enough).
- Reduced motion: no orbit, fly, door or dolly; instant fades ≤ 200 ms; map opens at the route, fully drawn.
- Contrast: lime only on dark backgrounds (16.6:1 on ink; 1.18:1 on white, so never lime text on paper). Grey text on dark uses `#8e8e93`, not `#6c6c70`. Main roads at least `#5A5F64` on the `#0B0C0D` background.
- All targets ≥ 44 px, visible focus.

## 8. Rules for every phase

**Gate (same as CI), must pass before the PR:**
```
npm run lint && npx tsc --noEmit && npm test && node scripts/with-db.mjs --local npx next build && npm run test:e2e
```

**Definition of done:**
- Gate passes locally.
- Pure logic covered by Vitest; UI covered by Playwright using `data-*` attributes, not pixels. No `waitForTimeout` over 500 ms in new tests.
- No new console errors or CSP "Refused" messages (reuse the console collector from `tour.spec.ts`).
- Screenshots saved to `test-results/shots/visit-<phase>-{desktop,phone}-*.png`.
- §0 tracker updated, work committed on `visit/phase-N`, PR opened with the gate output.

**Test hooks on `VisitStage`:**
`data-stage="hero|inside|map"`, `data-map-state="idle|loading|ready|flying|drawing|done|interrupted"`, `data-lights="open|closed|drop|soon"`, `data-fallback="none|reduced|lite|nowebgl"`.

**Test switches (only with `preview=open` or outside production):** `?motion=fast` (all durations × 0.1), `?now=2026-10-02T12:00+05:45`, `?lite=1`, `?gl=off`, `?tiles=fixture`.

**Playwright setup:** the SwiftShader `launchOptions` (`--use-angle=swiftshader`, `--enable-unsafe-swiftshader`, `--ignore-gpu-blocklist`) apply only to specs that draw 3D or a map, listed in `WEBGL_SPECS` in `playwright.config.ts` (tour now; add the Visit specs as they arrive). They run in their own projects, `desktop-3d` and `phone-3d`, after `desktop` and `phone`. Saroj, 7 Oct 2026: applied to every test they made the suite about 3.5× slower, and run beside other tests the 3D specs slowed those past their timeouts; tag phone tests `@phone`; never fetch real tiles in CI (use `public/map/fixture.pmtiles`). Visual regression only on HTML overlays with `mask: [page.locator("canvas")]`, desktop only, and baselines committed only after Saroj approves them.

**Claude Code must NOT:**
- Add paid or keyed APIs (Mapbox, Google Maps JS, routing services) or any new secret env var.
- Commit `.env*`, keys, real store coordinates before launch, or the PMTiles file.
- Remove or rename `StoreInfo.route`, or change the database schema/migrations.
- Touch payments (eSewa/Khalti/Fonepay), orders, auth, `PAYMENTS_MODE` or the shop.
- Loosen the CSP beyond what Phase 3b lists, or widen `geolocation` beyond `/visit`.
- Delete or weaken existing tests to make them pass (update them when behaviour changes on purpose, and say so).
- Edit the generated block in AGENTS.md.
- Ask for location outside the "From my location" button.
- Merge to main, force-push, or start the next phase.

**Stop and ask Saroj if:** a §3 decision looks wrong; a dependency not named in this plan is needed; the gate fails twice for the same reason; an existing test must change meaning.

## 9. Phases

### Phase 0: Setup (30 min)
- [x] Create `docs/`, add this file ~~and `docs/BLUEPRINT.md`~~ (the blueprint stays local and git-ignored: Saroj, 7 Oct 2026); add one line to `CLAUDE.md`: "For the Visit page, follow docs/VISIT_PAGE_PLAN.md one phase at a time."
- [x] Add the SwiftShader launch args (only for the 3D specs, in their own Playwright projects; see §8) and confirm the existing tour tests still pass.

### Phase 1a: Data and pure logic (1 session)
- [x] `StartPoint`, `entrancePhoto`, `parkingSpots` in `StoreInfo`; `DEFAULT_STORE`; `fill` list (including `geo`); `SAMPLE_STORE` with shifted sample `geo` and four sample routes.
- [x] Cache key → `store-info-v2`.
- [x] `src/lib/map/route.ts` (pipeline in §5 plus `lengthMeters`, `pointAt`, `bounds`, `minutes`, `stepAt`).
- [x] `src/lib/visit-status.ts`: `statusLine(state, info)` using `hourLabel`, and `lightsFor(state)`. Soon text comes from `state.headline`.
- [x] `src/lib/map/sequence.ts`: §6 as a pure table with `phaseAt(t, mode)` for first/repeat/deep-link/chip/soon.
- **Done when:** Vitest covers: pointAt 0/0.5/1; minutes per mode; stepAt; swapped coordinates; simplify; jump/length rejection; snap within 30 m and rejection beyond; no-pin error; legacy `route` fallback; statusLine for all four states incl. special day and drop Friday; sequence totals (5.6 / 3.4 / 1.5 s) and draw clamp.

### Phase 1b: Admin start points (1 session)
- [x] Parse start points, parking spots and entrance photo in `parseStoreForm` so a save never wipes them.
- [x] "Start points" group in `/admin/store`: name, paste box (GeoJSON/GPX/lat,lng), steps. Max 6 start points.
- [x] Preview: lazy-loaded `find-us-map.tsx` with a `preview` prop showing the line, pin and 30 m circle (until Phase 3 exists, an SVG with x scaled by cos(lat)).
- [x] Short help text: "Trace the route in geojson.io or record it with OsmAnd / Organic Maps, then paste it here."
- **Done when:** e2e saves and reloads a start point; saving other fields keeps it; the existing "Step 1" admin test still passes; parser errors show in plain words.

### Phase 2a: Stage, status and links, no 3D (1 session)
- [x] `page.tsx` renders `<VisitStage>` with HTML children: h1 "Come in.", status line, poster `<img>`, `<a href="/visit/tour">` and `<a href="#find-us">`. Strip private fields when `soon` (§5).
- [x] Move the soon `AlertSignup`/`Countdown` block into the new hero; remove `VisitHero` (keep `Row`/`Rule`).
- [x] Add `id="find-us"` to the Find us `<Section>` (extend `Section` to accept an id).
- [x] `RefreshAt` at the next open/close time.
- [x] `data-*` hooks and the test switches.
- [x] Rewrite `visit.spec.ts` assertions: h1 is "Come in." (soon state checks the status line for "Opening"); receipt checks move to the Find us section.
- **Done when:** JS-disabled test (`@phone`) shows status and both working hrefs; `data-lights` is right for each `?now=`; old receipt and admin tests pass in their new form.

### Phase 2b: Night store 3D (1–2 sessions)
- [x] Move `readFonts`, `fontsReady`, `loadLogos`, `storeEnvironment` to `store-assets.ts`; move tag/bill props to `getTourProps()`; the tour keeps working unchanged.
- [x] `buildStore` options: `door: "sliding"` (new glass door mesh, hidden by default so the tour is unchanged) and `BuiltStore.setNight(kind)` that dims/swaps the `glow()` materials. Shutter stays fully up (`apply(5)`).
- [x] `store-night.tsx`: night rig (blue hemisphere, moonlight, warm interior points, lime kiosk edge, lime roof line on drop day, construction lines for soon), slow orbit (off with reduced motion), hover previews, GPU tiers, demand frameloop, context-loss handling. Poster fades out on first frame.
- **Done when:** e2e: canvas visible, `data-lights` per state, zero console errors; the tour spec still passes; screenshots of the four states.

### Phase 3a: Map tiles and fonts (1 session, stop-and-ask)
- [x] Build the extract outside the repo (newest date from maps.protomaps.com/builds):
  ```
  pmtiles extract https://build.protomaps.com/YYYYMMDD.pmtiles valley.pmtiles --bbox=85.18,27.60,85.52,27.80 --maxzoom=13
  pmtiles extract https://build.protomaps.com/YYYYMMDD.pmtiles city.pmtiles   --bbox=85.27,27.66,85.37,27.75 --maxzoom=15
  # merge (tile-join), then:
  pmtiles show kathmandu-YYYYMMDD.pmtiles && pmtiles verify kathmandu-YYYYMMDD.pmtiles
  ```
- [x] **Report the file size to Saroj before uploading.** Upload to a public Supabase Storage bucket with the cache header; check `curl -sI -H "Range: bytes=0-16383" <url>` returns `206` with `Content-Range` and CORS allows `Range`.
- [x] Copy Noto Sans glyph ranges into `public/map/fonts/`. Make `public/map/fixture.pmtiles` (tiny) for tests.
- **Done when:** size, URL and Range check are in the PR; nothing large is committed.

### Phase 3b: Map, style and CSP (1 session)
- [x] Install `maplibre-gl`, `pmtiles`, `@protomaps/basemaps`. `find-us-map.tsx` via `next/dynamic({ ssr:false })` inside `visit-stage.tsx` only; import `maplibre-gl/dist/maplibre-gl.css` there.
- [x] `style.ts`: black flavour + our colours (§7 contrast), source `maxzoom: 15`, no POIs, no sprite, labels for places and major roads only.
- [x] Attribution control (not compact).
- [x] `next.config.ts`: add `worker-src 'self' blob:` and `child-src blob:` (old Safari); add the Supabase origin to `connect-src`. (Stricter option if it works cleanly: MapLibre CSP build + `setWorkerUrl('/map/maplibre-gl-csp-worker.js')`, then `worker-src 'self'` only.) Keep `frame-src https://www.google.com`.
- [x] One-context rule: snapshot 3D frame → unmount canvas → create map; `map.remove()` on leave.
- [x] State machine with `history.pushState('#find-us')`; `popstate`/`hashchange` returns to the hero; loading with `#find-us` goes straight to the map.
- **Done when:** build output shows no maplibre in the `/visit` first load; e2e reaches `data-map-state="ready"` with `?tiles=fixture`; zero CSP "Refused" messages; attribution visible.

### Phase 4: Motion sequence (1–2 sessions)
- [x] Drive everything from `sequence.ts`: matched hand-off, shared pin, pull-out, valley hold, fly, route draw (`pointAt`), settle, arrival.
- [x] Phone bottom bar from 1.0 s; Skip button; skip/tap/keys jump to the end in ≤ 300 ms; drag interrupts but shows the full route and panel.
- [x] Repeat-visit and deep-link variants; chip change retract/draw; Replay.
- [x] Map-not-ready handling.
- **Done when:** e2e with `?motion=fast` waits for `done`, checks panel visible and receipt lines lit in order; skip test; drag sets `interrupted` and panel still shows; deep-link test; Vitest on the table already passes.

### Phase 5: Directions and arrival (1 session)
- [x] `directions.tsx`: chips, Walk/Bike/Car minutes, receipt (tap a line → fly there, 600 ms), QUEUE 0 MIN, TOTAL.
- [x] Arrival card: status, address (selectable), landmark, entrance photo, parking markers; actions **Open in Google Maps** (`https://www.google.com/maps/dir/?api=1&destination=LAT,LNG&travelmode=walking`), Copy address (with fallback), WhatsApp, Look inside.
- [x] Bottom sheet snap points and focus handling.
- [x] Soon state: area only, "Exact address coming soon", opening list.
- **Done when:** e2e per action (hrefs, clipboard via granted permission, Look inside navigates), chip change updates receipt and minutes, focus moves to panel heading; masked screenshot of the panel for Saroj's review.

### Phase 6: Step inside, fallbacks, accessibility (1–2 sessions)
- [x] Door push and `door-poster.avif`; navigate to `/visit/tour#enter`.
- [x] In `WalkTour`, read `#enter` in an effect: `scrollTo(stops[1].from / DURATION * reach())` and set `time.now` before `started`. End of tour: "Get directions" → `/visit#find-us`. Back returns to the hero.
- [x] Fallbacks: reduced motion, lite (`?lite=1` / Save-Data / slow / low memory → poster + static route image + receipt), no WebGL (`?gl=off` → poster + `MapOnTap`).
- [ ] Accessibility items in §7; ask before adding `@axe-core/playwright`.
- [x] Optional "From my location": `Permissions-Policy` `geolocation=(self)` for `/visit` only; ask only on tap; `enableHighAccuracy:false`, no `watchPosition`; coordinates kept in component state only (never URL, storage, server, logs or analytics); draws a guide line and links to Google Maps.
- [ ] Optional sound toggle.
- **Done when:** tour spec extended for `#enter` (`data-chapter="enter"` within 5 s); each fallback has an e2e asserting `data-fallback` plus visible receipt and Google Maps link; keyboard test; axe has no serious/critical issues.

### Phase 7: Performance and launch (1 session)
- [x] Lighthouse mobile on `/visit?preview=open`: table of LCP, first-load JS, map-interactive time vs §7; list misses with fixes.
- [x] Manual checklist for Saroj: Redmi / Samsung A-series on Ncell and NTC 4G, inside Instagram and TikTok, iPhone Safari.
- [ ] After the lease: set the real pin, trace the four routes, take the entrance photo, update the static fallback image.

**Total:** about 5–6 weeks part-time. Phases 0–5 can be built now with sample data.

## 10. Prompts for Claude Code

**Header: paste at the start of every phase prompt (replace N):**
```
Read AGENTS.md and docs/VISIT_PAGE_PLAN.md (§0 tracker, §8 rules, §9 Phase N, plus §5–§7 where the phase refers to them), and the Next.js docs in node_modules/next/dist/docs/ for any API you use. Start in plan mode: list the files you'll change, the tests you'll add, and the existing tests your change will affect; wait for my OK. Work on branch visit/phase-N from main. Run the §8 gate. Stop and ask if a §3 decision looks wrong, you need a dependency not named in the plan, the gate fails twice for the same reason, or an existing test must change meaning. Finish by updating the §0 tracker, saving screenshots to test-results/shots/, committing, opening a PR with the gate output, and telling me what's left. Do not start the next phase.
```

**Phase 0:** `Do Phase 0: create docs/, add the plan and blueprint, add the CLAUDE.md line and the SwiftShader launch args. Confirm the existing tests pass.`

**Phase 1a:** `Do Phase 1a: data model, defaults, shifted sample data, cache key v2, route.ts, visit-status.ts and sequence.ts with all the Vitest cases listed. No UI.`

**Phase 1b:** `Do Phase 1b: parse the new fields in parseStoreForm so saves never wipe them, add the Start points group with the §5 pipeline, the preview and help text. E2E saves and reloads a start point; the existing "Step 1" admin test must still pass.`

**Phase 2a:** `Do Phase 2a: VisitStage with server-rendered status and two real links, no 3D yet. Strip private fields in the soon state, move the soon block, remove VisitHero, add id="find-us", RefreshAt, data-* hooks and test switches. Rewrite visit.spec.ts as described and add a JavaScript-disabled @phone test.`

**Phase 2b:** `Do Phase 2b: move the shared tour helpers out without changing the tour, add the sliding door and setNight(kind) to buildStore, and build store-night.tsx with the night rig, orbit, hover previews, GPU tiers and context-loss handling. Show me screenshots of open, closed, drop and soon.`

**Phase 3a:** `Do Phase 3a: build the Kathmandu PMTiles extract with the commands in the plan, tell me the file size before uploading anything, then upload to Supabase Storage and prove Range requests work. Add the glyphs and a tiny fixture tiles file. Don't commit the big file.`

**Phase 3b:** `Do Phase 3b: install maplibre-gl, pmtiles and @protomaps/basemaps, build find-us-map.tsx and style.ts, update the CSP exactly as listed, apply the one-WebGL-context rule and the #find-us state machine. Prove from build output that maplibre isn't in the /visit first load.`

**Phase 4:** `Do Phase 4: drive the whole sequence from sequence.ts as in §6, including the matched hand-off, shared pin, phone bottom bar, Skip, interrupt rules, repeat-visit and deep-link variants, chip changes and Replay. Record a short phone-viewport capture at normal speed.`

**Phase 5:** `Do Phase 5: directions.tsx, the arrival card with all actions using plain links, the bottom sheet and the soon state. E2E for every action and chip changes; masked panel screenshot for my review (don't commit the baseline until I approve).`

**Phase 6:** `Do Phase 6: the door push and hand-off to /visit/tour#enter (tour starts at the entrance, Back returns to the hero, end of tour links to directions), all three fallbacks, the §7 accessibility items and the optional location chip with the privacy rules. Ask before adding axe-core. Show me each fallback.`

**Phase 7:** `Do Phase 7: Lighthouse mobile run with a table against the §7 budgets, list misses with fixes, and write my manual device checklist. No new features.`

## 11. Phase 7 results (7 Oct 2026)

Measured on a production build on this laptop (`next start`, sample details, `/visit?preview=open`). The laptop's headless Chrome has **no graphics card**, so everything that draws 3D or the map is drawn in software and is far slower here than on a phone. Treat the 3D and map times as worst cases, and the checklist below as the real test.

### Against the §7 budgets

| Budget | Target | Measured | Result |
| --- | --- | --- | --- |
| LCP (the poster), Lighthouse mobile, simulated slow 4G + 4× slower CPU, 3 runs | < 2.5 s | 4.3 / 4.6 / 4.9 s | **Miss** |
| LCP, Lighthouse with the throttling really applied | < 2.5 s | 3.3 s | **Miss** |
| LCP, Chrome on slow 4G, normal CPU | < 2.5 s | 1.5 s | Pass |
| LCP, Chrome on slow 4G, 4× slower CPU | < 2.5 s | 2.6 s | Borderline |
| Layout shift (CLS) | 0 | 0 | Pass |
| Poster | ≤ 50 KB AVIF, high priority, real alt | 10.6 KB (828 wide; 17 KB at 1656), `fetchpriority="high"`, alt set, found in the first HTML | Pass |
| First load has no three / MapLibre code | none | none before the page is idle; MapLibre only after Find us is pointed at or pressed | Pass |
| Hero (3D) chunk | ≤ 250 KB, after the poster, when idle | 247 KB, requested about 2.2 s in, low priority | Pass (close to the limit) |
| Map chunk | ≤ 300 KB | 294 KB (Phase 3b build) | Pass (close to the limit) |
| JavaScript on first load, whole page | (none set) | 596 KB transferred in 25 files, of which 247 KB is the 3D chunk | For information |
| Page weight on first load | (none set) | 907 KB | For information |
| Key info on screen after Find us | ≤ 1.2 s | 1.95 s before the fix (the bar was set to appear at 1.0 s, plus software drawing); bar now at 0.7 s | **Miss here**, fix made, check on a phone |
| Map drawing after the tap, cold, slow 4G | ≤ 4 s | 4.4 s (software drawing) | **Miss here**, check on a phone |
| Panel in, first visit | ≤ 5.6 s | 8.4 s from the tap on cold slow 4G; the sequence itself is 5.6 s once the map has loaded (unit-tested) | **Miss on a cold load** |
| Skip completes | ≤ 300 ms | under 5 s is all the test can prove in software; the code jumps in one step (250 ms camera ease) | Not measurable here |
| Frame rate during the fly | 30 fps p95 on a mid-range Android | not measurable here | Phone check |
| Lighthouse accessibility | (none set) | 100 | Pass |
| Lighthouse best practices | (none set) | 96 (a 404 for Vercel's analytics script, which only exists on Vercel; no source maps) | Fine |
| Total blocking time, Lighthouse simulated | (none set) | 9–10 s, almost all of it building the 3D store in software at 4× slower CPU; 0.8 s with throttling really applied | Phone check |

### Misses, and what to do about each

1. **LCP in Lighthouse (4.3–4.9 s simulated, 3.3 s applied).** The poster itself is small and arrives early (it finished loading 0.2 s in). What Lighthouse is charging for is the processor: the site's own first-load JavaScript (about 350 KB before the 3D chunk, shared by every page: header, bag, search) and then the 3D store being built. Fixes, in order of value: (a) measure on the real site after merge, because Vercel serves compressed, cached files from a CDN and this laptop doesn't; (b) if it still misses, start the 3D store only after the page's `load` plus a quiet moment, or only when the hero has been on screen for a second; (c) the site-wide first-load JavaScript is the larger cost and is outside this plan.
2. **Key info after Find us (1.95 s here).** Fixed in this phase: the phone bar now comes in at 0.7 s instead of 1.0 s. The rest of the gap is software drawing. Check with a stopwatch on a phone.
3. **Panel in 8.4 s on a cold load.** The 5.6 s is the sequence; on a cold slow connection the map's code (294 KB) and first tiles come first. Fixed in part in this phase: the map's code is now fetched as soon as Find us is pointed at, focused or pressed. The useful information (walk time, Google Maps) does not wait for any of this.
4. **Supabase serves the map file with `no-cache`** (noted in Phase 3a). Each visit re-checks the file (a small 304). Moving the file to R2 would allow `immutable`; not needed for launch.
5. **Two chunks sit just under their limits** (247 of 250 KB, 294 of 300 KB). A three.js or MapLibre upgrade could push them over: check the build output after any upgrade.

### Found while measuring

- Lighthouse reported a first paint 1.3–2.3 s after the page had loaded, on the Visit page only. In Chrome itself (same machine, phone emulation) the first paint is at 0.2–0.45 s, so this is an artefact of the Lighthouse run, not something visitors see. One real cause was removed anyway: the device check that asks for a WebGL context ran before the first paint and now runs after it.
- The browser tests run against `next dev`, not a production build, so they prove behaviour, not speed.

### Manual checklist for Saroj

Do these on the Vercel preview of the branch (or the live site after merge), with `/visit?preview=open` until the real details are in.

**Phones and networks:** a Redmi (Note 11/12 class) and a Samsung A-series, each once on Ncell 4G and once on NTC 4G; an iPhone in Safari.

On each:

- [ ] The store picture is on screen within about 2 seconds of tapping the link; the 3D store fades in over it with no jump.
- [ ] The status line is right for the time of day (open / closed / drop day), and changes by itself at closing time without a reload.
- [ ] **Find us:** walk time and the Google Maps link appear within about a second; the map shows streets, not a blank dark screen; the lime line draws; the panel comes in. Skip works at any moment. Dragging the map stops the camera.
- [ ] The motion is smooth enough to follow (no long freezes) on the Redmi and the Samsung.
- [ ] Each start point redraws the line; Walk / Bike / Car change the minutes; tapping a receipt line moves the map there.
- [ ] The sheet drags between its three heights and never traps the page; "← The store" and the phone's Back both return to the store.
- [ ] **Open in Google Maps** opens the Google Maps app with the store as the destination. **WhatsApp** opens a chat picker with the address and link. **Copy address** copies it (paste it somewhere to check).
- [ ] **From my location** (open the page directly, not from the home page): the phone asks permission only on that tap; the dashed line and distance appear; refusing shows the Google Maps link.
- [ ] **Step inside:** the door opens, the camera goes in, the tour continues from inside with no black frame; Back returns to the store with the door closing; the end of the tour has Get directions.
- [ ] Turn on the phone's "reduce motion" setting: nothing flies or drifts, the map opens finished.
- [ ] Turn on Data Saver in Chrome: the page shows the picture, the receipt and the small still of the route, and loads no 3D and no map.
- [ ] Lock the phone for a minute on the map, unlock: the map is still there, or the page has dropped to the still of the route (never a blank screen).

**Inside Instagram and TikTok** (send yourself the link in a message and open it there): the page loads; Find us works; Google Maps, WhatsApp and Copy address all work from inside the app's browser.

**Before launch (after the lease):** set the real pin and address in admin; trace the four routes and paste them into the start points; add the entrance photo (host it in Supabase storage: the site only shows images from there); mark the parking; then ask Claude to remake `route-static.avif` for the real pin (the page hides the still until that's done) and to remove the sample start points.
