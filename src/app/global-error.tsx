"use client";

/** Last resort when even the layout fails. Plain HTML, no site styles needed. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#fff", color: "#0a0a0a" }}>
        <main style={{ maxWidth: 520, margin: "0 auto", padding: "96px 16px" }}>
          <p style={{ color: "#6c6c70", fontWeight: 600 }}>Easypick</p>
          <h1 style={{ fontSize: 40, margin: "8px 0 16px" }}>Something went wrong.</h1>
          <p style={{ color: "#6c6c70", fontSize: 18 }}>We couldn&apos;t load the site. Your bag and any payment are safe.</p>
          <button
            type="button"
            onClick={() => reset()}
            style={{ marginTop: 24, padding: "14px 22px", border: 0, borderRadius: 2, background: "#c6ff3d", fontWeight: 700, cursor: "pointer" }}
          >
            Try again
          </button>
          {error.digest && <p style={{ marginTop: 24, fontFamily: "monospace", fontSize: 12, color: "#6c6c70" }}>Ref {error.digest}</p>}
        </main>
      </body>
    </html>
  );
}
