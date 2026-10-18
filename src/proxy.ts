import { NextResponse, type NextRequest } from "next/server";

// A cheap first gate for the staff screens: without that portal's own login cookie, /admin/* and
// /helper/* go straight to their login page (each portal has its own login). It doesn't check the cookie's signature;
// every staff page and action still verifies the login itself (this only saves work
// and closes gaps like requests that skip a layout).

// "ep_admin" / "ep_helper", or a "__Host-" prefixed one if it's ever prefixed.
const COOKIE = { admin: /(^|_)ep_admin$/, helper: /(^|_)ep_helper$/ };
/** Admin addresses the helper portal uses too: the packing slip, the stock sheet, new-order alerts. */
const SHARED = ["/admin/live", "/admin/slip/", "/admin/stock/sheet"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const area = pathname.startsWith("/helper") ? "helper" : "admin";
  const login = `/${area}/login`;
  if (pathname === login || pathname.startsWith(`${login}/`)) return NextResponse.next();
  const has = (re: RegExp) => request.cookies.getAll().some((c) => re.test(c.name) && c.value);
  if (has(COOKIE[area])) return NextResponse.next();
  if (SHARED.some((p) => pathname === p || pathname.startsWith(p)) && has(COOKIE.helper)) return NextResponse.next();

  // The admin's new-order watcher polls with fetch: answer it plainly instead of with a page.
  if (pathname === "/admin/live") return NextResponse.json({ error: "signed out" }, { status: 401 });
  return NextResponse.redirect(new URL(login, request.url));
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/helper", "/helper/:path*"],
};
