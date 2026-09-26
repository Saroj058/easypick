"use client";

import { useEffect, useRef } from "react";

import { useBag } from "@/components/bag-provider";

const DONE_KEY = "ep-bag-cleared-v1";

function clearedOrders(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(DONE_KEY) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/**
 * Once an order from the bag is paid, takes its pieces out of the bag, once per order.
 * Opening the order page again later (after adding new things) leaves the bag alone,
 * and anything added that wasn't in this order stays.
 */
export function ClearBag({ orderId, skus }: { orderId: string; skus: string[] }) {
  const { ready, remove } = useBag();
  const done = useRef(false);
  const key = skus.join(",");
  useEffect(() => {
    if (!ready || done.current) return;
    done.current = true;
    const seen = clearedOrders();
    if (seen.includes(orderId)) return;
    for (const sku of key.split(",")) remove(sku);
    try {
      localStorage.setItem(DONE_KEY, JSON.stringify([...seen, orderId].slice(-30)));
    } catch {
      // Storage blocked: at worst the same pieces are taken out again next visit.
    }
  }, [ready, remove, orderId, key]);
  return null;
}
