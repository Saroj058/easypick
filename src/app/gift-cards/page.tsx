import { redirect } from "next/navigation";

// Gift cards are bought on the Gift page now (a sheet opens over it), so there is no page here.
// Old links, emails and bookmarks still arrive: /gift-cards#buy and /gift-cards#balance keep their
// #part through the redirect and land on the matching section of /gift.
export default function GiftCardsPage() {
  redirect("/gift");
}
