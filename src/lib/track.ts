// Tells the server a shopper looked at, bagged or saved a piece (for Trending). Fire and
// forget: it never delays the page, and a failure is silently ignored.

export function track(slug: string, kind: "view" | "bag" | "save") {
  try {
    const body = JSON.stringify({ slug, kind });
    if (navigator.sendBeacon?.("/api/events", new Blob([body], { type: "application/json" }))) return;
    void fetch("/api/events", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
  } catch {
    // tracking is never worth an error
  }
}
