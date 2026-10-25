import type { Metadata, Viewport } from "next";
import { Baloo_2, Barlow_Condensed, Instrument_Serif, Inter, JetBrains_Mono, Mukta } from "next/font/google";

import { PendingBagAdd } from "@/components/bag-gate";
import { BuySheets } from "@/components/buy-sheets";
import { SizeFinderHost } from "@/components/size-finder";
import { BagProvider } from "@/components/bag-provider";
import { FooterChrome, ShopChrome } from "@/components/shop-chrome";
import { SiteAnalytics } from "@/components/site-analytics";
import { SiteFooter } from "@/components/site-footer";
import { MobileTabBar, SiteHeader } from "@/components/site-header";
import { Announcement } from "@/components/announcement";
import { ktmDay } from "@/lib/ktm-day";
import { siteSetting } from "@/lib/settings/site";
import { announcing } from "@/lib/settings/site-rules";
import { site } from "@/lib/site";
import "./globals.css";

const barlow = Barlow_Condensed({ subsets: ["latin"], weight: ["200", "700"], variable: "--font-barlow", display: "swap" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "600"], variable: "--font-jetbrains", display: "swap" });
// The Vault's serif (owner, 25 Oct 2026: "like a luxury website"). Only the Vault uses it, so it isn't preloaded.
const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-instrument", display: "swap", preload: false });
const baloo = Baloo_2({ subsets: ["devanagari", "latin"], weight: "700", variable: "--font-baloo-2", display: "swap", preload: false });
const mukta = Mukta({ subsets: ["devanagari", "latin"], weight: ["400", "600"], variable: "--font-mukta", display: "swap", preload: false });

/** The search description comes from Admin → Site settings. */
export async function generateMetadata(): Promise<Metadata> {
  const settings = await siteSetting.get();
  return { ...metadata, description: settings.seo.description };
}

const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} — ${site.tagline}`,
    template: `%s | ${site.name} Kathmandu`,
  },
  description: "Self-checkout streetwear and everyday basics in Kathmandu. Fair fixed prices, new drops every other Friday. Pay with eSewa.",
  openGraph: { siteName: site.name, locale: "en_NP", type: "website" },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  viewportFit: "cover",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const settings = await siteSetting.get();
  return (
    <html lang="en" className={`${barlow.variable} ${inter.variable} ${jetbrains.variable} ${mukta.variable} ${baloo.variable} ${serif.variable} antialiased`}>
      <body className="flex min-h-dvh flex-col">
        <BagProvider>
          <ShopChrome>
            <SiteHeader />
          </ShopChrome>
          {announcing(settings, ktmDay()) && <Announcement text={settings.announcement.text} link={settings.announcement.link} />}
          <main id="main" className="flex-1">
            {children}
          </main>
          <ShopChrome>
            <FooterChrome>
              <SiteFooter />
            </FooterChrome>
            <MobileTabBar />
          </ShopChrome>
          <PendingBagAdd />
          <BuySheets />
          <SizeFinderHost />
          <SiteAnalytics />
        </BagProvider>
      </body>
    </html>
  );
}
