import type { Metadata } from "next";

export const metadata: Metadata = { title: "Your bag", robots: { index: false } };

export default function BagLayout({ children }: LayoutProps<"/bag">) {
  return children;
}
