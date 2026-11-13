import { describe, expect, it } from "vitest";
import {
  Checkpoint,
  CreateCheckpointInput,
  DashboardMetrics,
  Redemption,
  RewardBenefit,
  StaffMember,
  checkRedemptionValidation,
  conversionRate,
} from "./schemas";

const USER = "7d0e4c4a-1f2b-4c3d-8e9f-0a1b2c3d4e5f";
const STORE_A = "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed";
const STORE_B = "9c858901-8a57-4791-81fe-4c455b099bc9";
const CP = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const NOW = new Date("2026-11-14T10:00:00Z");

const admin = StaffMember.parse({ role: "admin", userId: USER });
const lojistaA = StaffMember.parse({ role: "lojista", userId: USER, storeId: STORE_A });

const reserved = Redemption.parse({
  id: "6ba7b810-9dad-41d1-80b4-00c04fd430c8",
  userId: USER,
  rewardId: "6ba7b811-9dad-41d1-80b4-00c04fd430c8",
  createdAt: "2026-11-14T09:00:00Z",
  status: "reserved",
  code: "482917",
  expiresAt: "2026-11-14T12:00:00Z",
});

const discountA = RewardBenefit.parse({ kind: "discount_percent", percent: 15, storeId: STORE_A });
const discountB = RewardBenefit.parse({ kind: "discount_percent", percent: 15, storeId: STORE_B });
const parking = RewardBenefit.parse({ kind: "free_parking", hours: 2 });

describe("StaffMember (D1, D6)", () => {
  it("lojista sempre tem loja", () => {
    expect(StaffMember.safeParse({ role: "lojista", userId: USER }).success).toBe(false);
  });

  it("admin não fica preso a uma loja", () => {
    expect(admin).toEqual({ role: "admin", userId: USER });
  });

  it("recusa papel desconhecido", () => {
    expect(StaffMember.safeParse({ role: "visitante", userId: USER }).success).toBe(false);
  });
});

describe("Checkpoint", () => {
  it("aceita checkpoint do shopping (sem loja) e de loja", () => {
    for (const storeId of [null, STORE_A]) {
      const cp = Checkpoint.safeParse({ id: CP, storeId, label: "Entrada Norte", dynamicQr: false, active: true });
      expect(cp.success).toBe(true);
    }
  });

  it("o formulário não envia id nem active e exige nome", () => {
    const ok = CreateCheckpointInput.safeParse({ storeId: null, label: "Palco", dynamicQr: false });
    expect(ok.success && !("id" in ok.data)).toBe(true);
    expect(CreateCheckpointInput.safeParse({ storeId: null, label: "", dynamicQr: false }).success).toBe(false);
  });
});

describe("checkRedemptionValidation (critérios 15–18)", () => {
  it("lojista valida cupom de resgate reservado da própria loja", () => {
    expect(checkRedemptionValidation(lojistaA, reserved, discountA, NOW)).toEqual({ ok: true, data: null });
  });

  it("lojista não valida cupom de resgate de outra loja", () => {
    const r = checkRedemptionValidation(lojistaA, reserved, discountB, NOW);
    expect(r).toMatchObject({ ok: false, error: "other_store" });
  });

  it("estacionamento grátis: lojista recusado, admin aceito", () => {
    expect(checkRedemptionValidation(lojistaA, reserved, parking, NOW)).toMatchObject({ ok: false, error: "admin_only" });
    expect(checkRedemptionValidation(admin, reserved, parking, NOW).ok).toBe(true);
  });

  it("admin valida cupom de resgate de qualquer loja", () => {
    expect(checkRedemptionValidation(admin, reserved, discountB, NOW).ok).toBe(true);
  });

  it("cupom de resgate já usado é recusado", () => {
    const used = Redemption.parse({
      ...reserved,
      status: "redeemed",
      redeemedAt: "2026-11-14T09:30:00Z",
      validatedByStoreId: STORE_A,
    });
    expect(checkRedemptionValidation(lojistaA, used, discountA, NOW)).toMatchObject({ ok: false, error: "already_used" });
  });

  it("cupom de resgate vencido é recusado, mesmo ainda marcado como reservado", () => {
    const late = new Date("2026-11-14T12:00:01Z");
    expect(checkRedemptionValidation(lojistaA, reserved, discountA, late)).toMatchObject({ ok: false, error: "expired" });
  });

  it("toda recusa traz uma mensagem com o próximo passo", () => {
    const r = checkRedemptionValidation(lojistaA, reserved, discountB, NOW);
    expect(!r.ok && r.message.length > 10).toBe(true);
  });
});

describe("DashboardMetrics e conversão (critérios 4–7)", () => {
  it("contagens nunca são negativas", () => {
    const base = {
      checkinsToday: 3,
      uniqueVisitors7d: 2,
      scansByCheckpoint: [{ checkpointId: CP, label: "Entrada", scans: 5 }],
      missionsCompleted: 1,
      redemptionsValidated: 0,
      leads: { A: { visits: 10, leads: 2 }, B: { visits: 0, leads: 0 } },
    };
    expect(DashboardMetrics.safeParse(base).success).toBe(true);
    expect(DashboardMetrics.safeParse({ ...base, checkinsToday: -1 }).success).toBe(false);
  });

  it("conversão é leads ÷ visitas, e null sem visitas", () => {
    expect(conversionRate({ visits: 10, leads: 2 })).toBe(0.2);
    expect(conversionRate({ visits: 0, leads: 0 })).toBeNull();
  });
});
