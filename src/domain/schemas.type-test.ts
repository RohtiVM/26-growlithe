/**
 * Testes de TIPO (rodam no `tsc --noEmit`, sem runtime).
 * Cada `@ts-expect-error` prova que um estado inválido NÃO compila.
 */
import type { z } from "zod";
import type { MissionRequirement, MissionLaunch } from "./schemas";
import {
  defineAction,
  ScanQrInput,
  User,
  type MissionProgress,
  type ProgressOf,
  type Redemption,
  type ScanSuccess,
  type Tier,
  type UserDTO,
  type UserId,
  type MissionId,
} from "./schemas";

type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? true : false;
type Expect<T extends true> = T;
type Prettify<T> = { [K in keyof T]: T[K] } & {};

/* O DTO do Zod é exatamente o que escreveríamos com utility types do TS. */
type UserDTOWithUtilityTypes = Prettify<
  Omit<User, "phone" | "pushToken" | "marketingOptIn" | "deletedAt"> & { tier: Tier }
>;
type _dtoMatches = Expect<Equal<UserDTO, UserDTOWithUtilityTypes>>;

/* Campos privados não existem no DTO. */
type _noPhone = Expect<Equal<"phone" extends keyof UserDTO ? true : false, false>>;

/* Narrowing por status. */
type _completed = Expect<Equal<ProgressOf<"completed">["status"], "completed">>;

/* Estados impossíveis não compilam. */
declare const missionId: MissionId;

// @ts-expect-error — "available" não tem `pointsAwarded`
const _bad1: MissionProgress = { status: "available", missionId, pointsAwarded: 10 };

// @ts-expect-error — "completed" exige `completedAt` e `pointsAwarded`
const _bad2: MissionProgress = { status: "completed", missionId };

declare const reserved: Extract<Redemption, { status: "reserved" }>;
// @ts-expect-error — cupom reservado ainda não tem `redeemedAt`
reserved.redeemedAt;

/* IDs com brand não se misturam. */
declare const userId: UserId;
const takesMission = (_id: MissionId) => {};
// @ts-expect-error — UserId não é MissionId
takesMission(userId);
// @ts-expect-error — string crua também não serve: precisa passar pelo schema
takesMission("6f1c...");

/* defineAction: input inferido do schema, erro "invalid_input" somado sozinho. */
const scan = defineAction(ScanQrInput, async (input) => {
  type _input = Expect<Equal<typeof input, z.infer<typeof ScanQrInput>>>;
  return { ok: false, error: "expired_qr", message: "..." };
});
type ScanReturn = Awaited<ReturnType<typeof scan>>;
type _errors = Expect<
  Equal<Extract<ScanReturn, { ok: false }>["error"], "expired_qr" | "invalid_input">
>;

// @ts-expect-error — campo `token` é obrigatório
void scan({});

export type { ScanSuccess };

/* Missão genérica de compra: categoria precisa existir no enum. */
const _okPurchase: MissionRequirement = { kind: "purchase_category", category: "vestuario" };
// @ts-expect-error — "roupas" não é uma StoreCategory
const _badCategory: MissionRequirement = { kind: "purchase_category", category: "roupas" };
// @ts-expect-error — missão relâmpago exige texto do push e multiplicador
const _badFlash: MissionLaunch = { type: "flash" };
