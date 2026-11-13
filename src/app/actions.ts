"use server";

/**
 * Server Actions — a borda entre o navegador e o domínio.
 * Toda entrada passa por um schema Zod (`defineAction`) antes de chegar aos
 * casos de uso em `src/server/services.ts`.
 */
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import {
  CreateCheckpointInput,
  CreateMissionInput,
  JoinWaitlistInput,
  PushSubscriptionInput,
  RedeemRewardInput,
  SCAN_ERROR_MESSAGES,
  ScanQrInput,
  ScanReceiptInput,
  Utm,
  ValidateRedemptionInput,
  defineAction,
  type Result,
  type ValidateError,
  type ValidateSuccess,
} from "@/domain/schemas";
import { AB_COOKIE, parseVariant } from "@/landing/ab-test";
import { getDb } from "@/server/db";
import { serverEnv } from "@/server/env";
import { createWebPushSender } from "@/server/push";
import { DYNAMIC_QR_TTL_S, qrUrl, resolveManualCode, signQrToken, verifyQrToken } from "@/server/qr";
import { createInfosimplesVerifier, localVerifier, withFallback } from "@/server/receipt-verifier";
import * as services from "@/server/services";
import {
  currentUserId,
  endAdminSession,
  endSession,
  isAdmin,
  startAdminSession,
  startSession,
} from "@/server/session";

const notAuthenticated = {
  ok: false,
  error: "not_authenticated",
  message: SCAN_ERROR_MESSAGES.not_authenticated,
} as const;

const forbidden = { ok: false, error: "forbidden", message: "Entre no painel do shopping." } as const;

const refreshVisitor = () => {
  revalidatePath("/app", "layout");
};

/* ------------------------------------------------------------------ */
/* Visitante                                                           */
/* ------------------------------------------------------------------ */

const EnterInput = z.object({
  name: z.string().trim().min(2, "Conta pra gente seu nome").max(80),
  email: z.email("Confira o e-mail"),
});

export const enterAsVisitor = defineAction(EnterInput, async (input): Promise<Result<null, never>> => {
  const user = services.findOrCreateVisitor(getDb(), input, new Date());
  await startSession(user.id);
  return { ok: true, data: null };
});

/** Entra como a visitante de demonstração (Marina), para o pitch. */
export const enterAsDemo = async (): Promise<void> => {
  const marina = getDb().users[0];
  if (marina !== undefined) await startSession(marina.id);
};

export const signOut = async (): Promise<void> => {
  await endSession();
};

export const scanQr = defineAction(ScanQrInput, async ({ token }) => {
  const userId = await currentUserId();
  if (userId === null) return notAuthenticated;
  const env = serverEnv();
  const now = new Date();
  const db = getDb();
  // Código curto digitado à mão (fallback acessível) ou token do QR.
  const manual = await resolveManualCode(
    token,
    db.checkpoints.map((c) => c.id),
    env.qrSigningSecret,
  );
  const verified =
    manual === null ? await verifyQrToken(token, env.qrSigningSecret, now) : ({ ok: true, data: manual } as const);
  if (!verified.ok) {
    return { ok: false, error: verified.error, message: SCAN_ERROR_MESSAGES[verified.error] } as const;
  }
  const result = services.scanCheckpoint(db, {
    userId,
    checkpointId: verified.data,
    now,
    enforceMallHours: env.enforceMallHours,
  });
  if (result.ok) refreshVisitor();
  return result;
});

const receiptVerifier = () => {
  const { infosimples } = serverEnv();
  return infosimples === null
    ? localVerifier
    : withFallback(createInfosimplesVerifier(infosimples), localVerifier);
};

export const scanReceipt = defineAction(ScanReceiptInput, async ({ missionId, qrUrl: url }) => {
  const userId = await currentUserId();
  if (userId === null) return notAuthenticated;
  const result = await services.scanReceipt(getDb(), receiptVerifier(), {
    userId,
    missionId,
    qrUrl: url,
    now: new Date(),
  });
  if (result.ok) refreshVisitor();
  return result;
});

export const redeemReward = defineAction(RedeemRewardInput, async ({ rewardId }) => {
  const userId = await currentUserId();
  if (userId === null) return notAuthenticated;
  const result = services.redeemReward(getDb(), { userId, rewardId, now: new Date() });
  if (result.ok) refreshVisitor();
  return result;
});

/** Guarda a inscrição de push deste aparelho para os avisos de Missão Relâmpago. */
export const savePushSubscription = defineAction(PushSubscriptionInput, async (sub) => {
  const userId = await currentUserId();
  if (userId === null) return notAuthenticated;
  services.savePushSubscription(getDb(), userId, sub, new Date());
  return { ok: true, data: null } as const;
});

/* ------------------------------------------------------------------ */
/* Landing page                                                        */
/* ------------------------------------------------------------------ */

export const joinWaitlist = defineAction(
  z.object({ lead: JoinWaitlistInput, utm: Utm }),
  async ({ lead, utm }) => {
    const variant = parseVariant((await cookies()).get(AB_COOKIE)?.value) ?? "A";
    const result = services.joinWaitlist(getDb(), lead, { variant, utm, now: new Date() });
    if (result.ok) revalidatePath("/");
    return result;
  },
);

/* ------------------------------------------------------------------ */
/* Painel do shopping                                                  */
/* ------------------------------------------------------------------ */

export const adminLogin = defineAction(
  z.object({ passcode: z.string().min(1, "Digite a senha do painel") }),
  async ({ passcode }): Promise<Result<null, "wrong_passcode">> => {
    if (passcode !== serverEnv().adminPasscode) {
      return { ok: false, error: "wrong_passcode", message: "Senha incorreta." };
    }
    await startAdminSession();
    return { ok: true, data: null };
  },
);

export const adminLogout = async (): Promise<void> => {
  await endAdminSession();
};

export const createMission = defineAction(CreateMissionInput, async (input) => {
  if (!(await isAdmin())) return forbidden;
  const db = getDb();
  const mission = services.createMission(db, input, new Date());
  revalidatePath("/admin", "layout");
  refreshVisitor();
  // Critério 2 da spec 001: quem ativou os avisos recebe o push no lançamento.
  const { vapid } = serverEnv();
  const push =
    mission.launch.type === "flash" && vapid !== null
      ? await services.notifyFlashMission(db, mission, createWebPushSender(vapid))
      : null;
  return { ok: true, data: { id: mission.id, notified: push?.sent ?? null } } as const;
});

export const createCheckpoint = defineAction(CreateCheckpointInput, async (input) => {
  if (!(await isAdmin())) return forbidden;
  const checkpoint = services.createCheckpoint(getDb(), input);
  revalidatePath("/admin", "layout");
  return { ok: true, data: { id: checkpoint.id } } as const;
});

export const validateRedemption = defineAction(
  ValidateRedemptionInput,
  async ({ code }): Promise<Result<ValidateSuccess, ValidateError | "forbidden">> => {
  if (!(await isAdmin())) return forbidden;
  const result = services.validateRedemption(getDb(), { code, now: new Date() });
  if (result.ok) {
    revalidatePath("/admin", "layout");
    refreshVisitor();
  }
  return result;
  },
);

/** QR dinâmico para o tablet da loja: um token novo a cada 60 s. */
export const dynamicQrToken = defineAction(
  z.object({ checkpointId: z.uuid() }),
  async ({ checkpointId }) => {
    if (!(await isAdmin())) return forbidden;
    const checkpoint = getDb().checkpoints.find((c) => c.id === checkpointId);
    if (checkpoint === undefined) return { ok: false, error: "not_found", message: "Ponto não encontrado." } as const;
    const env = serverEnv();
    const token = await signQrToken(checkpoint.id, env.qrSigningSecret, { ttlSeconds: DYNAMIC_QR_TTL_S });
    return { ok: true, data: { url: qrUrl(env.appUrl, token), ttlSeconds: DYNAMIC_QR_TTL_S } } as const;
  },
);
