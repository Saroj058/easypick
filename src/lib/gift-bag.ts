"use client";

import { useSyncExternalStore } from "react";

import type { Size } from "./types";

// The gift bag: pieces set aside to send together as one gift (owner, 15 Oct 2026), next to the
// normal bag. Kept on this device only (localStorage), with no personal details: just the pieces.
// Sent from the Bag page's "Gift bag" tab with the usual send-as-gift form.

export interface GiftBagItem {
  slug: string;
  sku: string;
  name: string;
  colour: string;
  size: Size;
  price: number;
}

const KEY = "ep-gift-bag-v1";
/** One box, a handful of pieces. */
export const GIFT_BAG_MAX = 6;
const EVENT = "ep:gift-bag";
const EMPTY: GiftBagItem[] = [];
let cache: { raw: string | null; items: GiftBagItem[] } = { raw: null, items: EMPTY };

function read(): GiftBagItem[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return EMPTY;
  }
  if (raw === cache.raw) return cache.items;
  let items: GiftBagItem[] = EMPTY;
  try {
    const v = JSON.parse(raw ?? "[]");
    if (Array.isArray(v)) {
      items = v
        .filter((x) => x && typeof x.slug === "string" && typeof x.sku === "string" && typeof x.name === "string" && typeof x.price === "number")
        .slice(0, GIFT_BAG_MAX);
    }
  } catch {
    items = EMPTY;
  }
  cache = { raw, items };
  return items;
}

function write(items: GiftBagItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items.slice(0, GIFT_BAG_MAX)));
  } catch {
    // Private mode: the gift bag lives only as long as this page.
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(fn: () => void) {
  const onStorage = (e: StorageEvent) => e.key === KEY && fn();
  window.addEventListener(EVENT, fn);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, fn);
    window.removeEventListener("storage", onStorage);
  };
}

export function useGiftBag(): GiftBagItem[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

/** Adds a piece; the same piece in the same size isn't added twice. False when the bag is full. */
export function addToGiftBag(item: GiftBagItem): "added" | "already" | "full" {
  const items = read();
  if (items.some((i) => i.sku === item.sku)) return "already";
  if (items.length >= GIFT_BAG_MAX) return "full";
  write([...items, item]);
  return "added";
}

export function removeFromGiftBag(sku: string) {
  write(read().filter((i) => i.sku !== sku));
}

export function clearGiftBag() {
  write([]);
}
