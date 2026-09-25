import type { Metadata } from "next";

import { LegalPage } from "@/components/legal-page";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Privacy", alternates: { canonical: "/privacy" } };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy" lead="What we collect, why, and how long we keep it." updated="Sep 2026">
      <p>
        This notice explains how {site.company.legalName} handles your personal information, in line with Nepal&apos;s Individual Privacy
        Act, 2075.
      </p>
      <h2>What we collect</h2>
      <ul>
        <li>Your phone number, when you order, pay at the kiosk, or sign up for drop alerts.</li>
        <li>
          If you create an account: your name, and optionally your email and your saved measurements in cm. If you sign in with Google, we
          receive your name, email and an account ID from Google. Never your password.
        </li>
        <li>Your delivery address and landmark, if you choose delivery.</li>
        <li>What you bought and when, online and in store.</li>
        <li>Basic, privacy-friendly website analytics (pages viewed, not who you are).</li>
      </ul>
      <h2>Why</h2>
      <ul>
        <li>To send bills and order updates.</li>
        <li>To deliver your order.</li>
        <li>To send drop alerts, only if you asked for them.</li>
        <li>To handle exchanges and refunds.</li>
      </ul>
      <p>We never sell your information.</p>
      <h2>Advertising pixels</h2>
      <p>Meta and TikTok pixels load only if you accept them in the cookie banner. You can say no and the site works the same.</p>
      <h2>CCTV in the store</h2>
      <p>
        The store uses CCTV for safety and to prevent theft. There are no cameras in or facing the fitting rooms. Footage is kept for a
        limited time and then deleted, and is only shared with the police when required.
      </p>
      <h2>How long we keep it</h2>
      <p>Order and billing records are kept as long as tax law requires. Alert sign-ups are deleted when you unsubscribe.</p>
      <h2>Sign-in</h2>
      <p>
        Signing in keeps a secure cookie on your device for up to 30 days. Signing out removes it and ends the session on our side too.
      </p>
      <h2>Your choices</h2>
      <p>Reply STOP to any alert to unsubscribe. To see or delete your information, message us and we&apos;ll handle it.</p>
    </LegalPage>
  );
}
