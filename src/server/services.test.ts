import { beforeEach, describe, expect, it } from "vitest";
import { CheckpointId, MissionId, RewardId, UserId } from "@/domain/schemas";
import { createSeedDb, SEED_IDS, type Db } from "./db";
import { localVerifier } from "./receipt-verifier";
import {
  createMission,
  expireRedemptions,
  joinWaitlist,
  redeemReward,
  scanCheckpoint,
  scanReceipt,
  validateRedemption,
} from "./services";

const NOW = new Date("2026-11-13T15:00:00-03:00");
const MARINA = UserId.parse(SEED_IDS.marina);
const cp = (n: number) => CheckpointId.parse(SEED_IDS.checkpoint(n));
const FLASH = MissionId.parse(SEED_IDS.mission(5));

/** Módulo 11 da chave de acesso (escrito de novo para não testar o código com ele mesmo). */
const withCheckDigit = (first43: string): string => {
  let sum = 0;
  for (let i = 0; i < first43.length; i++) {
    const fromRight = first43.length - 1 - i;
    sum += (first43.charCodeAt(i) - 48) * ((fromRight % 8) + 2);
  }
  const rest = sum % 11;
  return first43 + String(rest < 2 ? 0 : 11 - rest);
};

const receiptUrl = (cnpj: string, opts: { aamm?: string; numero?: string } = {}) =>
  `https://www.sefaz.to.gov.br/nfce/qrcode?p=${withCheckDigit(
    "17" + (opts.aamm ?? "2611") + cnpj + "65" + "001" + (opts.numero ?? "000000123") + "1" + "12345678",
  )}|2|1|1|ABCDEF`;

const MODA_CENTER = "12345678000195"; // vestuário
const BURGER_X = "33444555000163"; // alimentação

let db: Db;
beforeEach(() => {
  db = createSeedDb(NOW);
});

const marina = () => db.users.find((u) => u.id === MARINA);
const scan = (n: number, now = NOW) =>
  scanCheckpoint(db, { userId: MARINA, checkpointId: cp(n), now, enforceMallHours: false });

describe("scan de checkpoint", () => {
  it("check-in na entrada: pontos, presença e sequência de 3 dias completa a missão", () => {
    const result = scan(1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 10 do check-in + 200 da missão "Volte 3 dias seguidos".
    expect(result.data.pointsEarned).toBe(210);
    expect(result.data.completedMissions).toEqual([{ title: "Volte 3 dias seguidos", points: 200 }]);
    expect(marina()?.presence).toMatchObject({ status: "at_mall", entrance: "Entrada Norte" });
    expect(marina()?.points).toBe(1450);
  });

  it("o mesmo ponto só pontua uma vez por dia", () => {
    expect(scan(3).ok).toBe(true);
    expect(scan(3)).toMatchObject({ ok: false, error: "already_scanned_today" });
    const tomorrow = new Date(NOW.getTime() + 24 * 60 * 60 * 1000);
    expect(scan(3, tomorrow).ok).toBe(true);
  });

  it("caça ao tesouro em ordem: avança só com a pista certa e mostra a próxima", () => {
    const HUNT = SEED_IDS.mission(1);
    const wrong = scan(10); // pista 5 antes da 3
    expect(wrong.ok && wrong.data.progress.some((p) => p.missionId === HUNT)).toBe(false);

    const right = scan(8); // pista 3
    expect(right.ok).toBe(true);
    if (!right.ok) return;
    expect(right.data.progress.find((p) => p.missionId === HUNT)).toMatchObject({
      status: "in_progress",
      current: 3,
      target: 5,
    });
    expect(right.data.nextHint).toContain("Tecnologia");
  });

  it("completa a caça ao tesouro com o último QR", () => {
    scan(8);
    scan(9);
    const last = scan(10);
    expect(last.ok && last.data.completedMissions).toEqual([{ title: "Caça ao tesouro da Ala B", points: 150 }]);
  });

  it("avisa quando sobe de nível", () => {
    const user = marina();
    if (user === undefined) throw new Error("seed sem Marina");
    user.lifetimePoints = 1_990;
    const result = scan(3);
    expect(result.ok && result.data.tierUp).toBe("ouro");
  });

  it("recusa visitante desconhecido e checkpoint inexistente", () => {
    const stranger = UserId.parse(crypto.randomUUID());
    expect(scanCheckpoint(db, { userId: stranger, checkpointId: cp(1), now: NOW, enforceMallHours: false })).toMatchObject({
      ok: false,
      error: "not_authenticated",
    });
    const ghost = CheckpointId.parse(crypto.randomUUID());
    expect(scanCheckpoint(db, { userId: MARINA, checkpointId: ghost, now: NOW, enforceMallHours: false })).toMatchObject({
      ok: false,
      error: "invalid_qr",
    });
  });

  it("com horário ativado, recusa scan com o shopping fechado", () => {
    const night = new Date("2026-11-13T23:30:00-03:00");
    expect(scanCheckpoint(db, { userId: MARINA, checkpointId: cp(1), now: night, enforceMallHours: true })).toMatchObject({
      ok: false,
      error: "mall_closed",
    });
  });
});

describe("Missão Relâmpago com cupom fiscal (spec 001)", () => {
  const send = (qrUrl: string, now = NOW) =>
    scanReceipt(db, localVerifier, { userId: MARINA, missionId: FLASH, qrUrl, now });

  it("critério 3: QR que não é de NFC-e → invalid_receipt", async () => {
    expect(await send("https://growlithe.app/s/abc")).toMatchObject({ ok: false, error: "invalid_receipt" });
  });

  it("critério 4: CNPJ fora do shopping → store_not_in_mall", async () => {
    expect(await send(receiptUrl("99999999000199"))).toMatchObject({ ok: false, error: "store_not_in_mall" });
  });

  it("critério 5: loja de outra categoria → wrong_category", async () => {
    expect(await send(receiptUrl(BURGER_X))).toMatchObject({ ok: false, error: "wrong_category" });
  });

  it("critério 7: cupom de outro mês → receipt_outside_window", async () => {
    expect(await send(receiptUrl(MODA_CENTER, { aamm: "2610" }))).toMatchObject({
      ok: false,
      error: "receipt_outside_window",
    });
  });

  it("critério 8: sucesso credita pontos × multiplicador e mostra a loja", async () => {
    const result = await send(receiptUrl(MODA_CENTER));
    expect(result).toEqual({
      ok: true,
      data: {
        storeName: "Moda Center",
        category: "vestuario",
        pointsEarned: 400,
        multiplier: 2,
        verifiedBy: "local",
        tierUp: null,
      },
    });
    expect(marina()?.points).toBe(1640);
    expect(db.receipts).toHaveLength(1);
    // LGPD: guardamos o hash, nunca a chave.
    expect(db.receipts[0]?.accessKeyHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("critério 6: cupom já usado por outra pessoa → receipt_already_used", async () => {
    await send(receiptUrl(MODA_CENTER));
    const other = db.users[0];
    if (other === undefined) throw new Error("seed vazio");
    const second = await scanReceipt(db, localVerifier, {
      userId: MARINA,
      missionId: FLASH,
      qrUrl: receiptUrl(MODA_CENTER),
      now: NOW,
    });
    expect(second).toMatchObject({ ok: false, error: "receipt_already_used" });
  });

  it("critério 9: duas requisições simultâneas com o mesmo cupom creditam uma vez só", async () => {
    const url = receiptUrl(MODA_CENTER);
    const results = await Promise.all([send(url), send(url), send(url)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(marina()?.points).toBe(1640);
  });

  it("a missão vale uma vez por visitante, mesmo com outro cupom", async () => {
    await send(receiptUrl(MODA_CENTER));
    expect(await send(receiptUrl(MODA_CENTER, { numero: "000000999" }))).toMatchObject({
      ok: false,
      error: "mission_already_completed",
    });
  });

  it("missão encerrada → mission_not_active", async () => {
    const later = new Date(NOW.getTime() + 4 * 60 * 60 * 1000);
    expect(await send(receiptUrl(MODA_CENTER), later)).toMatchObject({ ok: false, error: "mission_not_active" });
  });
});

describe("criar missão (critério 1)", () => {
  it("cria Missão Relâmpago de compra por categoria", () => {
    const mission = createMission(
      db,
      {
        title: "Relâmpago do calçado",
        description: "Compre um calçado",
        requirement: { kind: "purchase_category", category: "calcados" },
        pointsReward: 100,
        startsAt: NOW,
        endsAt: new Date(NOW.getTime() + 60 * 60 * 1000),
        maxCompletionsPerUser: 1,
        storeId: null,
        launch: { type: "flash", pushTitle: "Relâmpago!", pushBody: "Compre um calçado", pointsMultiplier: 3 },
      },
      NOW,
    );
    expect(db.missions).toContainEqual(mission);
  });
});

describe("recompensas", () => {
  const PARKING = RewardId.parse(SEED_IDS.reward(1)); // 800 pts, bronze
  const GOLD_GIFT = RewardId.parse(SEED_IDS.reward(5)); // ouro

  it("resgata, debita pontos e o lojista valida o código uma vez", () => {
    const redeemed = redeemReward(db, { userId: MARINA, rewardId: PARKING, now: NOW });
    expect(redeemed.ok).toBe(true);
    expect(marina()?.points).toBe(440);
    expect(marina()?.lifetimePoints).toBe(1240); // gastar não reduz o nível

    const reservation = db.redemptions[0];
    if (reservation?.status !== "reserved") throw new Error("cupom não reservado");
    expect(reservation.code).toMatch(/^\d{6}$/);

    const validated = validateRedemption(db, { code: reservation.code, now: NOW });
    expect(validated).toMatchObject({ ok: true, data: { benefit: "2h de estacionamento grátis", visitorTier: "prata" } });
    expect(validateRedemption(db, { code: reservation.code, now: NOW })).toMatchObject({
      ok: false,
      error: "code_already_used",
    });
  });

  it("bloqueia recompensa de nível acima e saldo insuficiente", () => {
    expect(redeemReward(db, { userId: MARINA, rewardId: GOLD_GIFT, now: NOW })).toMatchObject({
      ok: false,
      error: "tier_locked",
    });
    redeemReward(db, { userId: MARINA, rewardId: PARKING, now: NOW });
    expect(redeemReward(db, { userId: MARINA, rewardId: PARKING, now: NOW })).toMatchObject({
      ok: false,
      error: "insufficient_points",
    });
  });

  it("código vencido expira e devolve os pontos", () => {
    redeemReward(db, { userId: MARINA, rewardId: PARKING, now: NOW });
    const reservation = db.redemptions[0];
    if (reservation?.status !== "reserved") throw new Error("cupom não reservado");
    const nextDay = new Date(NOW.getTime() + 25 * 60 * 60 * 1000);
    expireRedemptions(db, nextDay);
    expect(db.redemptions[0]?.status).toBe("expired");
    expect(marina()?.points).toBe(1240);
    expect(validateRedemption(db, { code: reservation.code, now: nextDay })).toMatchObject({
      ok: false,
      error: "code_not_found",
    });
  });
});

describe("lista de espera da landing page", () => {
  const ctx = { variant: "B" as const, utm: { source: "cartaz", medium: "qr", campaign: "ala-b" }, now: NOW };

  it("guarda variante e UTM e recusa e-mail repetido", () => {
    const input = { name: "Ana", email: "Ana@Example.com", profile: "visitante" as const, company: null, consentLgpd: true as const };
    expect(joinWaitlist(db, input, ctx)).toEqual({ ok: true, data: { position: 1 } });
    expect(db.leads[0]).toMatchObject({ email: "ana@example.com", variant: "B", utm: { source: "cartaz" } });
    expect(joinWaitlist(db, { ...input, email: "ana@example.com" }, ctx)).toMatchObject({
      ok: false,
      error: "already_on_list",
    });
  });
});
