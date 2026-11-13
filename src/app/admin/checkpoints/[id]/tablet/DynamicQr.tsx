"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { dynamicQrToken } from "@/app/actions";

export function DynamicQr({ checkpointId, label }: { checkpointId: string; label: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let refresh: ReturnType<typeof setTimeout> | undefined;

    const load = async () => {
      const result = await dynamicQrToken({ checkpointId });
      if (cancelled) return;
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setSvg(await QRCode.toString(result.data.url, { type: "svg", margin: 1 }));
      setSecondsLeft(result.data.ttlSeconds);
      // Renova um pouco antes de vencer.
      refresh = setTimeout(() => void load(), (result.data.ttlSeconds - 5) * 1000);
    };

    void load();
    const tick = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => {
      cancelled = true;
      clearTimeout(refresh);
      clearInterval(tick);
    };
  }, [checkpointId]);

  return (
    <main className="tablet-qr">
      <h1 style={{ margin: 0 }}>🔥 {label}</h1>
      {error !== null ? (
        <p role="alert">⚠️ {error}</p>
      ) : svg === null ? (
        <p>Gerando QR…</p>
      ) : (
        <div dangerouslySetInnerHTML={{ __html: svg }} role="img" aria-label={`QR Code de ${label}`} />
      )}
      <p style={{ fontSize: "1.25rem", margin: 0 }}>Escaneie com a câmera do celular e ganhe pontos</p>
      <p className="tabular" style={{ margin: 0 }}>
        Novo QR em {secondsLeft}s
      </p>
    </main>
  );
}
