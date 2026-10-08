// The gift itself, drawn once and used everywhere a gift is shown (the finder, the send form, the
// receiver's link): a matte black box, one lime ribbon, and a white tag that carries two short lines.
// It is only a picture (aria-hidden); the words on the tag are always said in text beside it.

export function GiftBox({
  tag,
  state = "closed",
  className = "",
}: {
  /** Two short lines for the tag, e.g. ["FOR SITA", "FROM AARAV"]. Kept to about 16 characters each. */
  tag?: [string, string];
  /** "idle": the lid lifts once or twice, as if about to be opened. "opening": the lid comes off and the box sinks away. */
  state?: "closed" | "idle" | "opening";
  className?: string;
}) {
  const clip = (s: string) => (s.length > 17 ? `${s.slice(0, 16)}…` : s);
  return (
    <svg viewBox="0 0 380 340" className={`gift-box ${className}`} aria-hidden>
      <g className={state === "opening" ? "gift-open-box" : undefined}>
        <ellipse cx="190" cy="318" rx="150" ry="12" className="fill-black/60" />
        <rect x="50" y="120" width="280" height="190" rx="4" className="fill-[#1b1c1f] stroke-[#3a3b40]" />
        <rect x="170" y="120" width="40" height="190" className="fill-volt" />
        {tag && (
          <g transform="rotate(7 276 206)">
            <rect x="218" y="176" width="124" height="60" rx="3" className="fill-paper" />
            <circle cx="229" cy="187" r="3.5" className="fill-ink" />
            <text x="229" y="209" className="fill-ink font-mono text-[11px] font-semibold tracking-[0.06em]">
              {clip(tag[0])}
            </text>
            <text x="229" y="225" className="fill-steel-dark font-mono text-[10px] tracking-[0.06em]">
              {clip(tag[1])}
            </text>
          </g>
        )}
      </g>
      <g className={state === "opening" ? "gift-open-lid" : state === "idle" ? "gift-lid" : undefined}>
        <rect x="36" y="78" width="308" height="52" rx="4" className="fill-[#232428] stroke-[#3a3b40]" />
        <rect x="170" y="78" width="40" height="52" className="fill-volt" />
        <path d="M190 78c-34-58-92-40-60-8 16 14 44 10 60 8zm0 0c34-58 92-40 60-8-16 14-44 10-60 8z" className="fill-volt stroke-ink" strokeWidth="2" />
      </g>
    </svg>
  );
}

/** The card that goes in the box, as a hang tag: who it is for, the words, who it is from. The same on the sender's preview and the receiver's link. */
export function GiftNote({ to, from, message, placeholder, className = "" }: { to: string; from: string | null; message: string; placeholder?: string; className?: string }) {
  const words = message.trim();
  return (
    <div className={`hang-tag mx-auto w-full max-w-sm px-6 pb-7 pt-9 text-center shadow-[0_1px_0_rgba(0,0,0,0.08)] ${className}`}>
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-steel-dark">For {to.trim() || "them"}</p>
      <p className="mt-3 min-h-[5.25rem] break-words text-lg leading-relaxed">{words ? `“${words}”` : <span className="text-steel-dark">{placeholder}</span>}</p>
      <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.16em] text-steel-dark">{from ? `From ${from}` : "From someone who thinks of you"}</p>
    </div>
  );
}
