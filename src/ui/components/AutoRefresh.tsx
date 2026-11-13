"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Recarrega os dados da página de tempos em tempos (só com a aba visível).
 * Faz o papel do Supabase Realtime enquanto o banco é o adaptador em memória.
 */
export function AutoRefresh({ everyMs }: { everyMs: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, everyMs);
    return () => {
      clearInterval(id);
    };
  }, [router, everyMs]);
  return null;
}
