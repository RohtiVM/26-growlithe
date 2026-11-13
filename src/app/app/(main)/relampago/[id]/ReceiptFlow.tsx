"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { scanReceipt } from "@/app/actions";
import { QrScanner } from "@/ui/components/QrScanner";
import { CATEGORY_NAMES, TIER_LABELS, formatPoints } from "@/ui/labels";

type ReceiptResult = Awaited<ReturnType<typeof scanReceipt>>;

export function ReceiptFlow({ missionId, completed }: { missionId: string; completed: boolean }) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<ReceiptResult | null>(null);
  const [pending, startTransition] = useTransition();

  if (result?.ok === true) {
    const d = result.data;
    return (
      <section className="result" aria-live="polite" style={{ paddingTop: 0 }}>
        <div className="emoji pop" aria-hidden="true">
          ✅
        </div>
        <p style={{ fontWeight: 800, fontSize: "1.375rem", margin: "8px 0" }}>Compra validada!</p>
        <p className="muted">
          Loja: {d.storeName} ({CATEGORY_NAMES[d.category].toLowerCase()})
        </p>
        <p className="big pop">+{formatPoints(d.pointsEarned)}</p>
        {d.multiplier > 1 && <p style={{ fontWeight: 700 }}>⚡ pontos ×{d.multiplier}</p>}
        {d.tierUp !== null && (
          <p className="chip" style={{ margin: "8px 0 16px" }}>
            {TIER_LABELS[d.tierUp]}: você subiu de nível!
          </p>
        )}
        <Link className="btn btn-block" href="/app/premios">
          Ver minhas recompensas
        </Link>
      </section>
    );
  }

  if (completed) {
    return (
      <div className="alert" role="status">
        <span aria-hidden="true">✅</span>
        <span>Você já completou esta missão. Fique de olho na próxima!</span>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        className="btn btn-block"
        onClick={() => {
          setOpen(true);
        }}
      >
        📷 Escanear meu cupom fiscal
      </button>
    );
  }

  return (
    <div className="stack">
      {result !== null && (
        <div className="alert alert-error" role="alert">
          <span aria-hidden="true">🧾</span>
          <span>{result.message}</span>
        </div>
      )}
      <QrScanner
        paused={pending}
        hint={pending ? "Conferindo o cupom…" : "Aponte para o QR Code no rodapé do cupom fiscal."}
        manualLabel="QR ilegível? Cole o link do QR do cupom"
        manualPlaceholder="https://…?p=1726…"
        onResult={(qrUrl) => {
          if (pending) return;
          startTransition(async () => {
            setResult(await scanReceipt({ missionId, qrUrl }));
          });
        }}
      />
    </div>
  );
}
