"use client";

import { useEffect, useState, useTransition } from "react";
import { savePushSubscription } from "@/app/actions";

type State = "checking" | "unsupported" | "ios-install" | "ask" | "denied" | "on";

/** Chave VAPID em base64url → bytes, formato que o `pushManager.subscribe` pede. */
const keyBytes = (base64url: string): Uint8Array<ArrayBuffer> => {
  const base64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
};

/** `toJSON()` tem campos opcionais; o servidor valida de novo com `PushSubscriptionInput`. */
const toInput = (subscription: PushSubscription) => {
  const json = subscription.toJSON();
  return {
    endpoint: json.endpoint ?? "",
    keys: { p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" },
  };
};

const isIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent);
const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches;

/** Card "Ativar avisos de Missão Relâmpago" (spec 001, D7). Some quando já está ativo. */
export function PushOptIn({ vapidPublicKey }: { vapidPublicKey: string }) {
  const [state, setState] = useState<State>("checking");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const check = async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        // No iPhone, o push só existe com o app adicionado à tela inicial.
        setState(isIos() && !isStandalone() ? "ios-install" : "unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        setState("denied");
        return;
      }
      const registration = await navigator.serviceWorker.register("/sw.js");
      const existing = await registration.pushManager.getSubscription();
      if (existing !== null && Notification.permission === "granted") {
        // Reenvia: o servidor em memória pode ter reiniciado e esquecido a inscrição.
        await savePushSubscription(toInput(existing));
        setState("on");
      } else {
        setState("ask");
      }
    };
    check().catch(() => {
      setState("unsupported");
    });
  }, []);

  if (state === "checking" || state === "unsupported" || state === "on") return null;

  if (state === "ios-install") {
    return (
      <section className="card" style={{ marginTop: 12 }} aria-label="Avisos">
        <p style={{ fontWeight: 700 }}>🔔 Quer saber das Missões Relâmpago na hora?</p>
        <p className="muted small">
          Toque em Compartilhar e depois em “Adicionar à Tela de Início”. Abra o Growlithe por lá para ativar os avisos.
        </p>
      </section>
    );
  }

  if (state === "denied") {
    return (
      <section className="card" style={{ marginTop: 12 }} aria-label="Avisos">
        <p style={{ fontWeight: 700 }}>🔕 Avisos bloqueados</p>
        <p className="muted small">
          Para saber das Missões Relâmpago, libere as notificações do Growlithe nas configurações do navegador.
        </p>
      </section>
    );
  }

  return (
    <section className="card row" style={{ marginTop: 12 }} aria-label="Avisos">
      <span aria-hidden="true">🔔</span>
      <div style={{ flex: 1 }}>
        <p style={{ fontWeight: 700 }}>Avisos de Missão Relâmpago</p>
        <p className="muted small">{error ?? "Pontos em dobro duram pouco. A gente avisa quando começar."}</p>
      </div>
      <button
        className="btn"
        style={{ padding: "0 14px" }}
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            try {
              const permission = await Notification.requestPermission();
              if (permission !== "granted") {
                setState(permission === "denied" ? "denied" : "ask");
                return;
              }
              const registration = await navigator.serviceWorker.ready;
              const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: keyBytes(vapidPublicKey),
              });
              const result = await savePushSubscription(toInput(subscription));
              if (result.ok) setState("on");
              else setError(result.message);
            } catch {
              setError("Não deu para ativar agora. Tente de novo em instantes.");
            }
          });
        }}
      >
        Ativar
      </button>
    </section>
  );
}
