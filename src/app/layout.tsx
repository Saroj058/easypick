import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Inter, JetBrains_Mono, Mukta } from "next/font/google";

import { PendingBagAdd } from "@/components/bag-gate";
import { BagProvider } from "@/components/bag-provider";
import { SiteFooter } from "@/components/site-footer";
import { MobileTabBar, SiteHeader } from "@/components/site-header";
import { site } from "@/lib/site";
import "./globals.css";

const barlow = Barlow_Condensed({ subsets: ["latin"], weight: "700", variable: "--font-barlow", display: "swap" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "600"], variable: "--font-jetbrains", display: "swap" });
const mukta = Mukta({ subsets: ["devanagari", "latin"], weight: ["400", "600"], variable: "--font-mukta", display: "swap", preload: false });

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} — ${site.tagline}`,
    template: `%s | ${site.name} Kathmandu`,
  },
  description: "Self-checkout streetwear and everyday basics in Kathmandu. Fair fixed prices, new drops every other Friday. Pay with eSewa, Khalti or Fonepay.",
  openGraph: { siteName: site.name, locale: "en_NP", type: "website" },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${barlow.variable} ${inter.variable} ${jetbrains.variable} ${mukta.variable} antialiased`}>
      <body className="flex min-h-dvh flex-col">
        <BagProvider>
          <SiteHeader />
          <main id="main" className="flex-1">
            {children}
          </main>
          <SiteFooter />
          <MobileTabBar />
          <PendingBagAdd />
        </BagProvider>
      </body>
    </html>
  );
}
