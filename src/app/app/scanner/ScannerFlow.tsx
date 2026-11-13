"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { scanQr } from "@/app/actions";
import { QrScanner } from "@/ui/components/QrScanner";
import { ScanResultView, type ScanActionResult } from "@/ui/components/ScanResultView";

export function ScannerFlow() {
  const [result, setResult] = useState<ScanActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  const handle = (text: string) => {
    if (pending || result !== null) return;
    startTransition(async () => {
      setResult(await scanQr({ token: text }));
    });
  };

  return (
    <main className="scanner">
      <div className="row between">
        <Link href="/app" className="btn btn-ghost" aria-label="Fechar scanner" style={{ width: 44, padding: 0 }}>
          ✕
        </Link>
        <strong>Escanear QR Code</strong>
        <span style={{ width: 44 }} />
      </div>

      {result === null ? (
        <>
          <QrScanner
            onResult={handle}
            paused={pending}
            hint={pending ? "Validando…" : "Aponte para o QR Code do Growlithe na loja, entrada ou evento."}
            manualLabel="Não consegue escanear? Digite o código do ponto"
            manualPlaceholder="Código impresso abaixo do QR"
          />
          <p className="muted small" style={{ textAlign: "center" }}>
            Missão Relâmpago? Abra a missão no início e escaneie o cupom fiscal por lá.
          </p>
        </>
      ) : (
        <ScanResultView
          result={result}
          onAgain={() => {
            setResult(null);
          }}
        />
      )}
    </main>
  );
}
