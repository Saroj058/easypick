"use client";

import { Fragment, useActionState, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { phoneStep, type PhoneState } from "@/app/auth-actions";

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

function FacebookMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <circle cx="12" cy="12" r="12" fill="#1877F2" />
      <path fill="#fff" d="M15.1 12.6l.4-2.6h-2.5V8.3c0-.7.4-1.4 1.5-1.4h1.1V4.7s-1-.2-2-.2c-2.1 0-3.4 1.2-3.4 3.5V10H8v2.6h2.2V19h2.8v-6.4h2.1z" />
    </svg>
  );
}

const input =
  "h-12 w-full rounded-xl border border-ink/20 bg-paper px-4 font-mono text-lg tracking-wide outline-none transition-[border-color,box-shadow] placeholder:text-steel focus:border-ink focus:shadow-[0_0_0_3px_rgba(10,10,10,0.06)] aria-[invalid=true]:border-error-light";
const primary =
  "inline-flex h-12 w-full cursor-pointer items-center justify-center rounded-full bg-ink px-6 text-[15px] font-semibold text-paper transition-[background-color,scale] hover:bg-[#222] active:scale-[0.98] disabled:cursor-wait disabled:opacity-60";

/** Before anything is sent: the starting answer (also how we know the page was just opened). */
const FIRST: PhoneState = { step: "phone" };

/** The last number this device sent a code to, so a returning customer just taps. Only the number. */
const LAST = "ep-last-phone";
const noSubscribe = () => () => {};
const readLast = () => {
  try {
    const v = localStorage.getItem(LAST);
    return v && /^9[78]\d{8}$/.test(v) ? v : null;
  } catch {
    return null;
  }
};

export function LoginPanel({
  next,
  providers,
  phoneOnly = false,
  channels = [],
}: {
  next: string;
  providers: { google: boolean; facebook: boolean };
  phoneOnly?: boolean;
  channels?: ("whatsapp" | "sms")[];
}) {
  const [state, action, pending] = useActionState<PhoneState, FormData>(phoneStep, FIRST);
  const codeRef = useRef<HTMLInputElement>(null);
  const verifyRef = useRef<HTMLButtonElement>(null);
  const [wait, setWait] = useState(0);
  // The typed code belongs to the server's latest answer: a new answer (a wrong code, a resend)
  // starts with empty boxes.
  const [entry, setEntry] = useState<{ answer: PhoneState; code: string }>({ answer: state, code: "" });
  const code = entry.answer === state ? entry.code : "";
  const setCode = (v: string) => setEntry({ answer: state, code: v });
  const last = useSyncExternalStore(noSubscribe, readLast, () => null);
  const [other, setOther] = useState(false);
  // Only on a freshly opened page: after "Change number" or an error they type the number.
  const welcomeBack = Boolean(last) && !other && !phoneOnly && state === FIRST;

  useEffect(() => {
    if (state.step !== "code") return;
    // A code went to this number: remember it on this device for next time (only the number).
    try {
      localStorage.setItem(LAST, state.phone);
    } catch {
      // Not remembered; fine.
    }
    codeRef.current?.focus();
    const tick = () => setWait(Math.max(0, 30 - Math.floor((Date.now() - state.sentAt) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [state]);

  const social = (p: "google" | "facebook", label: string, Mark: () => React.JSX.Element) => (
    <a
      href={`/api/auth/${p}?next=${encodeURIComponent(next)}`}
      className="flex h-12 w-full items-center justify-center gap-3 rounded-full border border-ink/20 bg-paper text-[15px] font-semibold transition-colors duration-200 hover:border-ink"
    >
      <Mark />
      {label}
    </a>
  );

  return (
    <div className="space-y-5">
      {!phoneOnly && state.step === "phone" && (providers.google || providers.facebook) && (
        <>
          <div className="space-y-2.5">
            {/* Each shown only once that sign-in is set up (GOOGLE_* / FACEBOOK_* env vars). */}
            {providers.google && social("google", "Continue with Google", GoogleMark)}
            {providers.facebook && social("facebook", "Continue with Facebook", FacebookMark)}
          </div>
          <div className="flex items-center gap-4" aria-hidden>
            <span className="h-px flex-1 bg-ink/10" />
            <span className="text-[12.5px] text-steel-dark">or with your phone</span>
            <span className="h-px flex-1 bg-ink/10" />
          </div>
        </>
      )}

      <form
        action={action}
        noValidate
        className="space-y-4"
      >
        <input type="hidden" name="next" value={next} />
        {phoneOnly && <input type="hidden" name="add" value="phone" />}

        {/* Separate keys: the number box and the code box must never be the same element. */}
        {state.step === "phone" ? (
          <Fragment key="phone">
            {welcomeBack && last ? (
              // A device that has signed in before: one tap.
              <div key="known" className="rounded-2xl border border-ink/10 bg-mist/40 p-4">
                <p className="text-[13px] text-steel-dark">Welcome back</p>
                <p className="mt-0.5 font-mono text-lg font-semibold tracking-wide">
                  {last.slice(0, 3)}•••{last.slice(-3)}
                </p>
                <input type="hidden" name="phone" value={last} />
                <button type="button" onClick={() => setOther(true)} className="mt-1 min-h-9 cursor-pointer text-[13px] font-semibold underline underline-offset-4">
                  Use another number
                </button>
              </div>
            ) : (
              <div key="typed">
                <label htmlFor="login-phone" className="block text-sm font-semibold">
                  Mobile number
                </label>
                <p id="login-phone-hint" className="text-[13px] text-steel-dark">
                  We&apos;ll send a 6-digit code{channels.length === 1 ? (channels[0] === "whatsapp" ? " on WhatsApp" : " by SMS") : ""}. No password.
                </p>
                <input
                  id="login-phone"
                  name="phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  placeholder="98XXXXXXXX"
                  autoFocus={other}
                  aria-describedby="login-phone-hint login-msg"
                  aria-invalid={Boolean(state.error)}
                  className={`${input} mt-2`}
                />
              </div>
            )}
            {channels.length > 1 && (
              <fieldset>
                <legend className="text-sm font-semibold">Send the code by</legend>
                <div className="mt-2 grid grid-cols-2 gap-1 rounded-full bg-mist p-1">
                  {channels.map((c, i) => (
                    <label key={c} className="relative cursor-pointer">
                      <input type="radio" name="channel" value={c} defaultChecked={i === 0} className="peer sr-only" />
                      <span className="flex h-10 items-center justify-center rounded-full text-[14px] font-semibold text-ink/60 transition-colors peer-checked:bg-paper peer-checked:text-ink peer-checked:shadow-[0_1px_4px_rgba(0,0,0,0.12)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-ink">
                        {c === "whatsapp" ? "WhatsApp" : "SMS"}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            {channels.length === 1 && <input type="hidden" name="channel" value={channels[0]} />}
            <button type="submit" name="intent" value="send" className={primary} disabled={pending} aria-busy={pending}>
              {pending ? "Sending…" : channels.length === 1 && channels[0] === "whatsapp" ? "Send code on WhatsApp" : "Send code"}
            </button>
          </Fragment>
        ) : (
          <Fragment key="code">
            <div>
              <label htmlFor="login-code" className="block text-sm font-semibold">
                Code sent{state.via === "whatsapp" ? " on WhatsApp" : state.via === "sms" ? " by SMS" : ""} to {state.masked}
              </label>
              <p id="login-code-hint" className="text-[13px] text-steel-dark">
                It fills in by itself on most phones. Valid for 5 minutes.
              </p>
              {/* One real input (so the phone's code autofill and pasting work), drawn as six boxes. */}
              <div className="relative mt-3">
                <div aria-hidden className="grid grid-cols-6 gap-2">
                  {Array.from({ length: 6 }, (_, i) => (
                    <span
                      key={i}
                      className={`flex h-14 items-center justify-center rounded-xl border font-mono text-2xl font-semibold transition-colors ${
                        state.error ? "border-error-light" : i === Math.min(code.length, 5) ? "border-ink shadow-[0_0_0_3px_rgba(10,10,10,0.06)]" : code[i] ? "border-ink/40" : "border-ink/15"
                      }`}
                    >
                      {code[i] ?? ""}
                    </span>
                  ))}
                </div>
                <input
                  ref={codeRef}
                  id="login-code"
                  name="code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={code}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                    setCode(v);
                    // All six in: sign in, no button to press.
                    if (v.length === 6 && !pending) requestAnimationFrame(() => verifyRef.current?.form?.requestSubmit(verifyRef.current));
                  }}
                  aria-describedby="login-code-hint login-msg"
                  aria-invalid={Boolean(state.error)}
                  className="absolute inset-0 h-full w-full cursor-text bg-transparent text-transparent caret-transparent outline-none [&::selection]:bg-transparent"
                />
              </div>
            </div>
            {state.devCode && (
              <p className="rounded-xl bg-mist/60 px-4 py-3 text-[13px]">
                <span className="font-semibold">Texts aren&apos;t connected yet:</span> your code is <span className="font-mono font-semibold">{state.devCode}</span>
              </p>
            )}
            <button ref={verifyRef} type="submit" name="intent" value="verify" className={primary} disabled={pending} aria-busy={pending}>
              {pending ? "Checking…" : "Continue"}
            </button>
            <div className="flex items-center justify-between text-[13.5px]">
              <button type="submit" name="intent" value="change" className="min-h-11 cursor-pointer underline underline-offset-4" formNoValidate>
                Change number
              </button>
              <button type="submit" name="intent" value="resend" className="min-h-11 cursor-pointer underline underline-offset-4 disabled:cursor-default disabled:no-underline disabled:opacity-50" disabled={wait > 0 || pending}>
                {wait > 0 ? `Resend in ${wait}s` : "Resend code"}
              </button>
            </div>
          </Fragment>
        )}

        <p id="login-msg" role="alert" className="min-h-5 text-[13px] text-error-light">
          {state.error ?? ""}
        </p>
      </form>
    </div>
  );
}
