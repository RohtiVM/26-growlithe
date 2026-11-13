"use client";

import { useEffect, useRef, useState } from "react";

type CameraState = "starting" | "running" | "denied" | "unavailable";

/**
 * Lê QR Codes pela câmera traseira (ZXing roda no navegador, inclusive no
 * iPhone) e sempre oferece a digitação manual como alternativa acessível.
 */
export function QrScanner({
  onResult,
  paused,
  hint,
  manualLabel,
  manualPlaceholder,
}: {
  onResult: (text: string) => void;
  paused: boolean;
  hint: string;
  manualLabel: string;
  manualPlaceholder: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onResultRef = useRef(onResult);
  const pausedRef = useRef(paused);
  const [camera, setCamera] = useState<CameraState>("starting");
  const [manual, setManual] = useState("");

  onResultRef.current = onResult;
  pausedRef.current = paused;

  useEffect(() => {
    let stop: (() => void) | undefined;
    let cancelled = false;

    const start = async () => {
      const video = videoRef.current;
      if (video === null) return;
      // Sem HTTPS (ou em navegador antigo) `mediaDevices` não existe, apesar do tipo do DOM.
      if (!("mediaDevices" in navigator)) {
        setCamera("unavailable");
        return;
      }
      try {
        const { BrowserQRCodeReader } = await import("@zxing/browser");
        const reader = new BrowserQRCodeReader(undefined, { delayBetweenScanAttempts: 250 });
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" } }, audio: false },
          video,
          (result) => {
            if (result !== undefined && !pausedRef.current) onResultRef.current(result.getText());
          },
        );
        if (cancelled) {
          controls.stop();
          return;
        }
        stop = () => {
          controls.stop();
        };
        setCamera("running");
      } catch (error) {
        if (cancelled) return;
        const name = error instanceof Error ? error.name : "";
        setCamera(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "unavailable");
      }
    };

    void start();
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  return (
    <div className="stack">
      <div className="viewfinder">
        <video ref={videoRef} muted playsInline aria-label="Imagem da câmera" />
        {camera !== "running" && (
          <div className="placeholder">
            {camera === "starting" && <p>Abrindo a câmera…</p>}
            {camera === "denied" && (
              <p>
                Sem acesso à câmera. Libere a câmera nas configurações do navegador ou digite o código
                abaixo.
              </p>
            )}
            {camera === "unavailable" && <p>Câmera indisponível neste aparelho. Digite o código abaixo.</p>}
          </div>
        )}
      </div>
      <p className="muted" style={{ textAlign: "center", margin: 0 }}>
        {hint}
      </p>

      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          if (manual.trim() !== "" && !paused) onResult(manual.trim());
        }}
      >
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="manual-code">{manualLabel}</label>
          <input
            id="manual-code"
            className="input"
            value={manual}
            onChange={(e) => {
              setManual(e.target.value);
            }}
            placeholder={manualPlaceholder}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
          />
        </div>
        <button className="btn btn-ghost" type="submit" disabled={paused || manual.trim() === ""}>
          Enviar código
        </button>
      </form>
    </div>
  );
}
