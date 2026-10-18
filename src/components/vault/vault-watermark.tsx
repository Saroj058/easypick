/**
 * A brand's name as a faint watermark behind the Vault (owner, 18 Oct 2026): set huge in rows,
 * turned a little, every other row shifted, in the page's own colour so it reads as texture, not
 * text. The name only, never a logo. Hidden from screen readers.
 */
export function VaultWatermark({ text, tone = "deep", rows = 6 }: { text: string; tone?: "deep" | "light"; rows?: number }) {
  const word = text.toUpperCase();
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 select-none overflow-hidden">
      <div className="absolute -inset-x-[20%] -top-[10%] flex -rotate-[8deg] flex-col gap-[0.5em]">
        {Array.from({ length: rows }, (_, i) => (
          <p
            key={i}
            className={`display whitespace-nowrap text-[clamp(5rem,4rem+8vw,13rem)] leading-[0.82] ${tone === "light" ? "text-white/[0.04]" : "text-[var(--v-deep)]/[0.055]"} ${i % 2 ? "translate-x-[-18%]" : ""}`}
          >
            {`${word} · `.repeat(6)}
          </p>
        ))}
      </div>
    </div>
  );
}
