"use client";

import { ArrowUp } from "lucide-react";
import React, { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

// A slim white pill input with a softly shining black orb, and example questions that type themselves out as the
// placeholder. From a shadcn-style "OrbInput" (owner, 15 Oct 2026), made into a real field: it is
// controlled, submits, has a send button and stretches to its container. The original loaded its
// orb as a GIF from another site; here the orb is drawn in CSS (no outside file, nothing for the
// Content-Security-Policy to block). With reduced motion, the first example simply shows.

export interface OrbInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onSubmit"> {
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: () => void;
  /** Example questions, typed out one after another while the field is empty. */
  placeholders?: string[];
  /** Fixed placeholder (no typing), e.g. when a number is asked for. */
  staticPlaceholder?: string;
  /** The send button is disabled while this is true. */
  busy?: boolean;
  inputRef?: React.Ref<HTMLInputElement>;
  label: string;
  className?: string;
}

const CHAR_DELAY = 55;
const IDLE_AFTER = 2000;

export function OrbInput({ value, onValueChange, onSubmit, placeholders = ["Ask anything…"], staticPlaceholder, busy = false, inputRef, label, className, onFocus, onBlur, ...input }: OrbInputProps) {
  const [focused, setFocused] = useState(false);
  const [round, setRound] = useState({ index: 0, chars: 0 });
  const [still, setStill] = useState(false);

  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    const set = () => setStill(m.matches);
    set();
    m.addEventListener("change", set);
    return () => m.removeEventListener("change", set);
  }, []);

  // Types the current example out, waits, then moves to the next. Paused while they type.
  const typing = !still && !staticPlaceholder && !value;
  const current = Array.from(placeholders[round.index % placeholders.length] ?? "");
  const done = round.chars >= current.length;
  useEffect(() => {
    if (!typing) return;
    const t = done
      ? setTimeout(() => setRound((r) => ({ index: (r.index + 1) % placeholders.length, chars: 0 })), IDLE_AFTER)
      : setTimeout(() => setRound((r) => ({ ...r, chars: r.chars + 1 })), CHAR_DELAY);
    return () => clearTimeout(t);
  }, [typing, done, round, placeholders.length]);

  const placeholder = staticPlaceholder ?? (still ? current.join("") : `${current.slice(0, round.chars).join("")}${done ? "" : "|"}`);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!busy && value.trim()) onSubmit();
      }}
      className={cn(
        "flex items-center gap-2.5 rounded-full border bg-paper p-1.5 shadow-[0_12px_30px_-20px_rgba(10,10,10,0.45)] transition-[border-color,box-shadow,scale] duration-300 ease-out",
        focused ? "scale-[1.01] border-ink shadow-[0_16px_36px_-20px_rgba(10,10,10,0.5)]" : "border-ink/15",
        className,
      )}
    >
      {/* The orb: a soft, slowly turning sphere */}
      <span aria-hidden className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full">
        <span className="orb-spin absolute -inset-2 rounded-full bg-[conic-gradient(from_0deg,#0a0a0a,#5a5a5a,#000000,#9a9a9a,#0a0a0a)] blur-[6px]" />
        <span className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_35%_30%,rgba(255,255,255,0.85),rgba(255,255,255,0)_45%)]" />
        <span className="absolute inset-0 rounded-full shadow-[inset_0_-6px_12px_rgba(0,0,0,0.35)]" />
      </span>

      <span aria-hidden className="h-6 w-px shrink-0 bg-ink/15" />

      <label className="min-w-0 flex-1">
        <span className="sr-only">{label}</span>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          placeholder={placeholder}
          autoComplete="off"
          enterKeyHint="send"
          className="h-9 w-full bg-transparent text-base text-ink outline-none placeholder:text-ink/40 md:text-[15px]"
          {...input}
        />
      </label>

      <button
        type="submit"
        disabled={busy || !value.trim()}
        aria-label="Send"
        className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-full bg-ink text-paper transition-[opacity,scale,background-color] active:scale-95 disabled:cursor-default disabled:bg-mist disabled:text-steel"
      >
        <ArrowUp aria-hidden className="h-4 w-4" />
      </button>
    </form>
  );
}

export default OrbInput;
