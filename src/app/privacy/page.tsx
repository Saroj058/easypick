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
        <li>
          Page counts from Vercel Web Analytics: which pages are viewed and roughly from which country. It uses no cookies and can&apos;t tell
          who you are. Gift links, order pages and your account are never counted.
        </li>
      </ul>
      <h2>Why</h2>
      <ul>
        <li>To send bills and order updates.</li>
        <li>To deliver your order.</li>
        <li>To send drop alerts, only if you asked for them.</li>
        <li>To handle exchanges and refunds.</li>
      </ul>
      <p>We never sell your information.</p>
      <h2>Advertising</h2>
      <p>We don&apos;t use advertising pixels or tracking cookies. If that ever changes, we&apos;ll ask you first.</p>
      <h2>Who helps us</h2>
      <ul>
        <li>eSewa, to take payments. We never see your wallet PIN or password.</li>
        <li>An SMS provider and email (Gmail or Resend), to send codes, order updates and gift links.</li>
        <li>Vercel (website hosting) and Supabase (database and photos, stored in Mumbai, India).</li>
        <li>Google, only if you choose to sign in with Google.</li>
      </ul>
      <h2>CCTV in the store</h2>
      <p>
        The store uses CCTV for safety and to prevent theft. There are no cameras in or facing the fitting rooms. Footage is kept for a
        limited time and then deleted, and is only shared with the police when required.
      </p>
      <h2>How long we keep it</h2>
      <ul>
        <li>Order and billing records: as long as tax law requires. After 18 months we remove the name, phone, address and gift message from an order and keep only what the accounts need.</li>
        <li>Login codes: deleted once they expire (5 minutes). Sign-in sessions: deleted when they end.</li>
        <li>Restock alerts: deleted 90 days after we message you. Alert sign-ups are deleted when you unsubscribe.</li>
      </ul>
      <h2>Sign-in</h2>
      <p>
        Signing in keeps a secure cookie on your device for up to 30 days. Signing out removes it and ends the session on our side too.
      </p>
      <h2>Your choices</h2>
      <p>Reply STOP to any alert to unsubscribe. To see or delete your information, message us and we&apos;ll handle it.</p>
    </LegalPage>
  );
}
