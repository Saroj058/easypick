import { site, walletLabels } from "@/lib/site";
import type { PaymentProvider } from "@/lib/types";

/**
 * The wallet choice on checkout and gift forms, from site.payments.enabled. With one
 * wallet it's a plain note (and a hidden field); with more, a row of choices.
 */
export function PayWith({ value, onChange, className = "" }: { value?: PaymentProvider; onChange?: (p: PaymentProvider) => void; className?: string }) {
  const enabled = site.payments.enabled;
  if (enabled.length === 1) {
    const only = enabled[0];
    return (
      <div className={className}>
        <input type="hidden" name="provider" value={only} />
        <p className="flex min-h-[52px] items-center gap-3 rounded-[2px] border border-mist px-4 py-3 text-[15px]">
          <span className="font-semibold">{walletLabels[only]}</span>
          <span className="text-steel-dark">You&apos;ll finish paying on {walletLabels[only]}&apos;s own page.</span>
        </p>
      </div>
    );
  }
  const current = value && enabled.includes(value) ? value : enabled[0];
  return (
    <div className={`grid gap-2 ${enabled.length === 2 ? "grid-cols-2" : "grid-cols-3"} ${className}`} role="radiogroup" aria-label="Pay with">
      {enabled.map((p) => (
        <label key={p} className="relative cursor-pointer">
          <input
            type="radio"
            name="provider"
            value={p}
            {...(onChange ? { checked: current === p, onChange: () => onChange(p) } : { defaultChecked: current === p })}
            className="peer sr-only"
          />
          <span className="flex h-12 items-center justify-center rounded-[2px] border border-mist font-semibold peer-checked:border-ink peer-checked:ring-1 peer-checked:ring-ink peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink">
            {walletLabels[p]}
          </span>
        </label>
      ))}
    </div>
  );
}
