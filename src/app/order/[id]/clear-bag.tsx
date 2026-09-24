"use client";

import { useEffect, useRef } from "react";

import { useBag } from "@/components/bag-provider";

/** Empties the bag once an order exists for it. */
export function ClearBag() {
  const { ready, clear } = useBag();
  const done = useRef(false);
  useEffect(() => {
    if (!ready || done.current) return;
    done.current = true;
    clear();
  }, [ready, clear]);
  return null;
}
