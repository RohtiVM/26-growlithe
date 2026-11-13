"use client";

import { useEffect, useRef, useState } from "react";
import { scanQr } from "@/app/actions";
import { ScanResultView, type ScanActionResult } from "@/ui/components/ScanResultView";

export function AutoScan({ token }: { token: string }) {
  const [result, setResult] = useState<ScanActionResult | null>(null);
  const started = useRef(false);

  useEffect(() => {
    // Strict Mode monta duas vezes em dev; o scan só pode acontecer uma.
    if (started.current) return;
    started.current = true;
    void scanQr({ token }).then(setResult);
  }, [token]);

  if (result === null) {
    return (
      <section className="result" aria-live="polite">
        <div className="emoji" aria-hidden="true">
          🔥
        </div>
        <p style={{ fontWeight: 700 }}>Validando seu QR Code…</p>
      </section>
    );
  }
  return <ScanResultView result={result} />;
}
