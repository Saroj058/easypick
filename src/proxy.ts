import { NextResponse, type NextRequest } from "next/server";

// A cheap first gate for the staff screens: with no staff login cookie at all, /admin/* and
// /helper/* go straight to their login page. It doesn't check the cookie's signature;
// every staff page and action still verifies the login itself (this only saves work
// and closes gaps like requests that skip a layout).

const STAFF_COOKIE = /(^|_)ep_admin$/; // "ep_admin", or a "__Host-ep_admin" if it's ever prefixed

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const area = pathname.startsWith("/helper") ? "helper" : "admin";
  const login = `/${area}/login`;
  if (pathname === login || pathname.startsWith(`${login}/`)) return NextResponse.next();
  if (request.cookies.getAll().some((c) => STAFF_COOKIE.test(c.name) && c.value)) return NextResponse.next();

  // The admin's new-order watcher polls with fetch: answer it plainly instead of with a page.
  if (pathname === "/admin/live") return NextResponse.json({ error: "signed out" }, { status: 401 });
  return NextResponse.redirect(new URL(login, request.url));
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/helper", "/helper/:path*"],
};
