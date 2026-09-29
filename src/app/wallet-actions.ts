"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/lib/auth";
import { checkGiftCard, normaliseCode } from "@/lib/gift-cards";
import { clientIp } from "@/lib/rate-limit";
import { claimCard, walletFor, type WalletCard } from "@/lib/wallet";

export type BalanceState = { status: "idle" } | { status: "ok"; balance: number; expiresAt: string } | { status: "error"; message: string };

/** The gift card page's balance checker. Counted against the same guessing limit as checkout. */
export async function checkBalance(_prev: BalanceState, form: FormData): Promise<BalanceState> {
  const code = String(form.get("code") ?? "").slice(0, 40);
  const res = await checkGiftCard(code, await clientIp());
  return res.ok ? { status: "ok", balance: res.balance, expiresAt: res.expiresAt } : { status: "error", message: res.message };
}

export type WalletState = { status: "idle" } | { status: "saved"; message: string } | { status: "error"; message: string };

/** "Add to my account": checks the code, then keeps the card in this person's wallet. */
export async function addCardToAccount(_prev: WalletState, form: FormData): Promise<WalletState> {
  const user = await getCurrentUser();
  if (!user) return { status: "error", message: "Log in first, then add the card." };
  const check = await checkGiftCard(String(form.get("code") ?? "").slice(0, 40), await clientIp());
  if (!check.ok) return { status: "error", message: check.message };
  const code = normaliseCode(check.code)!;
  const res = await claimCard(code, user.id);
  if (!res.ok) return { status: "error", message: res.message };
  revalidatePath("/account");
  return { status: "saved", message: "Saved to your account. It's used at checkout automatically." };
}

/** Cards in the signed-in person's wallet that can pay right now (for checkout). */
export async function myUsableCards(): Promise<Pick<WalletCard, "code" | "balance" | "expiresAt">[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  return (await walletFor(user.id)).filter((c) => c.usable).map(({ code, balance, expiresAt }) => ({ code, balance, expiresAt }));
}
