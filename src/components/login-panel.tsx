"use client";

import { useActionState, useEffect, useRef, useState } from "react";

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

const input = "h-14 w-full rounded-[2px] border border-steel-dark bg-paper px-4 font-mono text-lg tracking-wide";

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
  const [state, action, pending] = useActionState<PhoneState, FormData>(phoneStep, { step: "phone" });
  const codeRef = useRef<HTMLInputElement>(null);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (state.step !== "code") return;
    codeRef.current?.focus();
    const tick = () => setWait(Math.max(0, 30 - Math.floor((Date.now() - state.sentAt) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [state]);

  const social = (p: "google" | "facebook", label: string, Mark: () => React.JSX.Element) => (
    <a
      href={`/api/auth/${p}?next=${encodeURIComponent(next)}`}
      className="flex h-[52px] w-full items-center justify-center gap-3 rounded-[2px] border border-steel-dark bg-paper text-[15px] font-semibold transition-colors duration-200 [@media(hover:hover)]:hover:bg-photo"
    >
      <Mark />
      {label}
    </a>
  );

  return (
    <div className="space-y-6">
      {!phoneOnly && (providers.google || providers.facebook) && (
        <>
          <div className="space-y-3">
            {/* Each shown only once that sign-in is set up (GOOGLE_* / FACEBOOK_* env vars). */}
            {providers.google && social("google", "Continue with Google", GoogleMark)}
            {providers.facebook && social("facebook", "Continue with Facebook", FacebookMark)}
          </div>

          <div className="flex items-center gap-4" aria-hidden>
            <span className="h-px flex-1 bg-mist" />
            <span className="text-[13px] text-steel-dark">or use your phone</span>
            <span className="h-px flex-1 bg-mist" />
          </div>
        </>
      )}

      <form action={action} noValidate className="space-y-4">
        <input type="hidden" name="next" value={next} />
        {phoneOnly && <input type="hidden" name="add" value="phone" />}

        {state.step === "phone" ? (
          <>
            <div>
              <label htmlFor="login-phone" className="block text-sm font-semibold">
                Mobile number
              </label>
              <p id="login-phone-hint" className="text-[13px] text-steel-dark">
                We&apos;ll send you a 6-digit code{channels.length === 1 ? (channels[0] === "whatsapp" ? " on WhatsApp" : " by SMS") : ""}. No password.
              </p>
              <input
                id="login-phone"
                name="phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                placeholder="98XXXXXXXX"
                aria-describedby="login-phone-hint login-msg"
                aria-invalid={Boolean(state.error)}
                className={`${input} mt-2`}
              />
            </div>
            {channels.length > 1 && (
              <fieldset>
                <legend className="text-sm font-semibold">Send the code by</legend>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {channels.map((c, i) => (
                    <label key={c} className="relative">
                      <input type="radio" name="channel" value={c} defaultChecked={i === 0} className="peer sr-only" />
                      <span className="flex h-12 items-center justify-center rounded-[2px] border border-mist text-[15px] font-semibold peer-checked:border-ink peer-checked:ring-1 peer-checked:ring-ink peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink">
                        {c === "whatsapp" ? "WhatsApp" : "SMS"}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            {channels.length === 1 && <input type="hidden" name="channel" value={channels[0]} />}
            <button type="submit" name="intent" value="send" className="btn btn-ink w-full" disabled={pending} aria-busy={pending}>
              {channels.length === 1 && channels[0] === "whatsapp" ? "Send code on WhatsApp" : "Send code"}
            </button>
          </>
        ) : (
          <>
            <div>
              <label htmlFor="login-code" className="block text-sm font-semibold">
                Code sent{state.via === "whatsapp" ? " on WhatsApp" : state.via === "sms" ? " by SMS" : ""} to {state.masked}
              </label>
              <p id="login-code-hint" className="text-[13px] text-steel-dark">
                Valid for 5 minutes. 3 tries.
              </p>
              <input
                ref={codeRef}
                id="login-code"
                name="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="••••••"
                aria-describedby="login-code-hint login-msg"
                aria-invalid={Boolean(state.error)}
                className={`${input} mt-2 text-center text-2xl tracking-[0.5em]`}
              />
            </div>
            {state.devCode && (
              <p className="border-l-4 border-volt bg-photo px-4 py-3 text-[13px]">
                <span className="font-semibold">Dev mode, no SMS yet:</span> your code is <span className="font-mono font-semibold">{state.devCode}</span>
              </p>
            )}
            <button type="submit" name="intent" value="verify" className="btn btn-ink w-full" disabled={pending} aria-busy={pending}>
              Continue
            </button>
            <div className="flex items-center justify-between text-sm">
              <button type="submit" name="intent" value="change" className="min-h-11 underline underline-offset-2" formNoValidate>
                Change number
              </button>
              <button type="submit" name="intent" value="resend" className="min-h-11 underline underline-offset-2 disabled:no-underline disabled:opacity-50" disabled={wait > 0 || pending}>
                {wait > 0 ? `Resend in ${wait}s` : "Resend code"}
              </button>
            </div>
          </>
        )}

        <p id="login-msg" role="alert" className="min-h-5 text-[13px] text-error-light">
          {state.error ?? ""}
        </p>
      </form>
    </div>
  );
}
