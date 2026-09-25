import { site } from "@/lib/site";

const WhatsAppGlyph = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
    <path d="M12.04 2a9.9 9.9 0 0 0-8.5 14.98L2 22l5.16-1.5A9.93 9.93 0 1 0 12.04 2Zm0 18.13a8.2 8.2 0 0 1-4.2-1.15l-.3-.18-3.06.89.9-2.98-.2-.31a8.2 8.2 0 1 1 6.86 3.73Zm4.5-6.14c-.25-.12-1.46-.72-1.69-.8-.23-.08-.39-.12-.55.12-.16.25-.63.8-.78.97-.14.16-.29.18-.53.06a6.7 6.7 0 0 1-1.97-1.22 7.4 7.4 0 0 1-1.37-1.7c-.14-.25 0-.38.11-.5.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.55-1.33-.76-1.82-.2-.48-.4-.41-.55-.42h-.47a.9.9 0 0 0-.65.3 2.74 2.74 0 0 0-.86 2.04 4.76 4.76 0 0 0 1 2.53 10.9 10.9 0 0 0 4.18 3.7c.58.25 1.04.4 1.4.51.58.19 1.12.16 1.54.1.47-.07 1.46-.6 1.66-1.18.2-.57.2-1.07.14-1.17-.06-.1-.22-.16-.47-.28Z" />
  </svg>
);

/**
 * "Ask us on WhatsApp" with the product or order already in the message, the way
 * people in Kathmandu already ask sellers. Hidden in production until the number is set.
 */
export function AskWhatsApp({ text, label = "Ask us on WhatsApp", className = "" }: { text: string; label?: string; className?: string }) {
  const number = site.store.whatsapp;
  if (!number && process.env.NODE_ENV === "production") return null;
  // In development without a number, WhatsApp opens and asks who to send it to.
  const href = `https://wa.me/${number ?? ""}?text=${encodeURIComponent(text)}`;
  return (
    <a href={href} target="_blank" rel="noopener" className={`inline-flex min-h-11 items-center gap-2 text-[14px] font-semibold underline-offset-4 hover:underline ${className}`}>
      <WhatsAppGlyph className="h-5 w-5 text-[#1f9d55]" />
      {label}
    </a>
  );
}
