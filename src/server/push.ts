/**
 * Adaptador de Web Push (protocolo padrão dos navegadores, chaves VAPID).
 * Funciona no Android, no computador e no iPhone com o app na tela inicial.
 */
import "server-only";
import webpush from "web-push";
import type { PushSender } from "./services";

const statusOf = (error: unknown): number | null =>
  typeof error === "object" && error !== null && "statusCode" in error && typeof error.statusCode === "number"
    ? error.statusCode
    : null;

export const createWebPushSender = (vapid: {
  publicKey: string;
  privateKey: string;
  subject: string;
}): PushSender => {
  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
  return async (sub, payload) => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
        { TTL: 60 * 60, urgency: "high", topic: payload.tag.slice(0, 32) },
      );
      return "sent";
    } catch (error) {
      const status = statusOf(error);
      return status === 404 || status === 410 ? "gone" : "failed";
    }
  };
};
