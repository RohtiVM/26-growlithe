import { describe, expect, it } from "vitest";
import {
  REDEMPTION_LOOKUP_MESSAGES,
  RedemptionCode,
  RedemptionPreviewRow,
  RedemptionValidateRow,
  StoreId,
  UserId,
  redemptionLookupMessage,
  type PainelAccess,
} from "@/domain/schemas";
import { confirmRedemption, previewRedemption, type RedemptionRpc } from "./redemptions";

const USER = UserId.parse("7d0e4c4a-1f2b-4c3d-8e9f-0a1b2c3d4e5f");
const STORE_A = StoreId.parse("1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed");

const ADMIN: PainelAccess = { kind: "staff", staff: { role: "admin", userId: USER } };
const LOJISTA: PainelAccess = { kind: "staff", staff: { role: "lojista", userId: USER, storeId: STORE_A } };

const OK_ROW = {
  result: "ok",
  benefit: { kind: "discount_percent", percent: 15, storeId: STORE_A },
  reward_title: "15% na Moda Cerrado",
  store_id: STORE_A,
  first_name: "Marina",
  lifetime_points: 650,
  expires_at: "2026-11-14T12:00:00Z",
};

/** Banco falso: registra os códigos recebidos e devolve a resposta combinada. */
const fakeRpc = (response: { data: unknown } | { errorCode: string }) => {
  const calls: string[] = [];
  const rpc: RedemptionRpc = async (code) => {
    calls.push(code);
    return "data" in response
      ? { data: response.data, error: null }
      : { data: null, error: { code: response.errorCode } };
  };
  return { rpc, calls };
};

describe("RedemptionCode (borda do formulário)", () => {
  it("aceita 6 dígitos, inclusive com espaços em volta", () => {
    expect(RedemptionCode.parse(" 482917 ")).toBe("482917");
  });

  it.each(["48291", "4829170", "48a917", "", "48 291"])("recusa %j", (raw) => {
    expect(RedemptionCode.safeParse(raw).success).toBe(false);
  });
});

describe("RedemptionPreviewRow (banco → DTO, RNF05)", () => {
  it("monta o DTO com primeiro nome, nível e texto do benefício", () => {
    expect(RedemptionPreviewRow.parse(OK_ROW)).toEqual({
      kind: "found",
      preview: {
        rewardTitle: "15% na Moda Cerrado",
        benefitText: "15% de desconto",
        firstName: "Marina",
        tier: "prata",
        expiresAt: new Date("2026-11-14T12:00:00Z"),
      },
    });
  });

  it("nunca deixa passar e-mail, telefone, CPF nem sobrenome", () => {
    const parsed = RedemptionPreviewRow.parse({
      ...OK_ROW,
      first_name: "Marina Souza",
      email: "marina@visitante.test",
      phone: "+5563999990000",
      cpf: "12345678909",
    });
    expect(JSON.stringify(parsed)).not.toMatch(/visitante\.test|5563|12345678909|Souza/);
  });

  it("visitante sem nome aparece como Visitante", () => {
    const parsed = RedemptionPreviewRow.parse({ ...OK_ROW, first_name: "  " });
    expect(parsed.kind === "found" && parsed.preview.firstName).toBe("Visitante");
  });

  it("cupom de resgate já usado traz a data em que foi usado", () => {
    // Formato do jsonb do Postgres: microssegundos e fuso.
    expect(RedemptionPreviewRow.parse({ result: "already_used", redeemed_at: "2026-11-14T13:32:00.123456+00:00" })).toEqual({
      kind: "refused",
      error: "already_used",
      redeemedAt: new Date("2026-11-14T13:32:00.123Z"),
    });
  });

  it.each(["not_found", "expired", "other_store", "admin_only"] as const)("erro %s não traz data", (result) => {
    expect(RedemptionPreviewRow.parse({ result })).toEqual({ kind: "refused", error: result, redeemedAt: null });
  });

  it("recusa resposta desconhecida do banco", () => {
    expect(RedemptionPreviewRow.safeParse({ result: "talvez" }).success).toBe(false);
    expect(RedemptionPreviewRow.safeParse({ ...OK_ROW, benefit: { kind: "x" } }).success).toBe(false);
  });
});

describe("RedemptionValidateRow", () => {
  it("confirmação traz a hora da validação", () => {
    expect(RedemptionValidateRow.parse({ result: "ok", redeemed_at: "2026-11-14T13:32:00Z" })).toEqual({
      kind: "validated",
      redeemedAt: new Date("2026-11-14T13:32:00Z"),
    });
  });
});

describe("redemptionLookupMessage", () => {
  it("not_found tem mensagem própria que diz o que fazer", () => {
    expect(REDEMPTION_LOOKUP_MESSAGES.not_found).toMatch(/Confira os 6 dígitos/);
  });

  it("critério 16: já usado mostra data e hora no fuso de Palmas", () => {
    const msg = redemptionLookupMessage("already_used", new Date("2026-11-14T13:32:00Z"));
    expect(msg).toMatch(/^Este cupom de resgate já foi usado em 14\/11\/2026 às 10:32\./);
  });

  it("critério 17: outra loja", () => {
    expect(redemptionLookupMessage("other_store", null)).toMatch(/^Este cupom de resgate é de outra loja/);
  });

  it("os demais erros usam as mensagens já combinadas", () => {
    expect(redemptionLookupMessage("expired", null)).toBe(REDEMPTION_LOOKUP_MESSAGES.expired);
    expect(redemptionLookupMessage("admin_only", null)).toBe(REDEMPTION_LOOKUP_MESSAGES.admin_only);
  });
});

describe("previewRedemption (critério 15, UC9)", () => {
  it.each([
    ["lojista", LOJISTA],
    ["admin", ADMIN],
  ] as const)("%s confere o código e vê benefício, primeiro nome e nível", async (_name, access) => {
    const db = fakeRpc({ data: OK_ROW });
    const r = await previewRedemption(access, " 482917", db.rpc);
    expect(r).toEqual({
      ok: true,
      data: {
        code: "482917",
        rewardTitle: "15% na Moda Cerrado",
        benefitText: "15% de desconto",
        firstName: "Marina",
        tier: "prata",
        expiresAt: new Date("2026-11-14T12:00:00Z"),
      },
    });
    expect(db.calls).toEqual(["482917"]);
  });

  it.each([
    ["sem sessão", { kind: "anonymous" }, "not_authenticated"],
    ["sem papel", { kind: "no_access" }, "forbidden"],
  ] as const)("%s não chega ao banco", async (_name, access, error) => {
    const db = fakeRpc({ data: OK_ROW });
    const r = await previewRedemption(access, "482917", db.rpc);
    expect(!r.ok && r.error).toBe(error);
    expect(db.calls).toEqual([]);
  });

  it("código inválido não chega ao banco", async () => {
    const db = fakeRpc({ data: OK_ROW });
    const r = await previewRedemption(LOJISTA, "12ab", db.rpc);
    expect(r).toEqual({ ok: false, error: "invalid_input", message: "Digite os 6 dígitos do cupom de resgate." });
    expect(db.calls).toEqual([]);
  });

  it.each(["not_found", "expired", "other_store", "admin_only"] as const)("mapeia %s", async (result) => {
    const db = fakeRpc({ data: { result } });
    const r = await previewRedemption(LOJISTA, "482917", db.rpc);
    expect(r).toEqual({ ok: false, error: result, message: REDEMPTION_LOOKUP_MESSAGES[result] });
  });

  it("critério 16: já usado com data e hora", async () => {
    const db = fakeRpc({ data: { result: "already_used", redeemed_at: "2026-11-14T13:32:00Z" } });
    const r = await previewRedemption(LOJISTA, "482917", db.rpc);
    expect(!r.ok && r.error).toBe("already_used");
    expect(!r.ok && r.message).toMatch(/14\/11\/2026 às 10:32/);
  });

  it("banco recusa por permissão (42501) → forbidden", async () => {
    const db = fakeRpc({ errorCode: "42501" });
    const r = await previewRedemption(LOJISTA, "482917", db.rpc);
    expect(!r.ok && r.error).toBe("forbidden");
  });

  it("falha do banco ou resposta estranha → unavailable", async () => {
    const down = await previewRedemption(LOJISTA, "482917", fakeRpc({ errorCode: "08006" }).rpc);
    const weird = await previewRedemption(LOJISTA, "482917", fakeRpc({ data: { result: "?" } }).rpc);
    expect(!down.ok && down.error).toBe("unavailable");
    expect(!weird.ok && weird.error).toBe("unavailable");
  });
});

describe("confirmRedemption (critérios 16–19)", () => {
  it("lojista confirma e recebe a hora da validação", async () => {
    const db = fakeRpc({ data: { result: "ok", redeemed_at: "2026-11-14T13:32:00Z" } });
    const r = await confirmRedemption(LOJISTA, "482917", db.rpc);
    expect(r).toEqual({ ok: true, data: { redeemedAt: new Date("2026-11-14T13:32:00Z") } });
    expect(db.calls).toEqual(["482917"]);
  });

  it("papel é conferido antes de chamar o banco", async () => {
    const db = fakeRpc({ data: { result: "ok", redeemed_at: "2026-11-14T13:32:00Z" } });
    const r = await confirmRedemption({ kind: "no_access" }, "482917", db.rpc);
    expect(!r.ok && r.error).toBe("forbidden");
    expect(db.calls).toEqual([]);
  });

  it("critério 19: quem perde a corrida vê já usado", async () => {
    const db = fakeRpc({ data: { result: "already_used", redeemed_at: "2026-11-14T13:32:00Z" } });
    const r = await confirmRedemption(ADMIN, "482917", db.rpc);
    expect(!r.ok && r.message).toMatch(/^Este cupom de resgate já foi usado em/);
  });

  it.each(["not_found", "expired", "other_store", "admin_only"] as const)("mapeia %s", async (result) => {
    const r = await confirmRedemption(LOJISTA, "482917", fakeRpc({ data: { result } }).rpc);
    expect(r).toEqual({ ok: false, error: result, message: REDEMPTION_LOOKUP_MESSAGES[result] });
  });

  it("entrada inválida", async () => {
    const r = await confirmRedemption(LOJISTA, 482917, fakeRpc({ data: null }).rpc);
    expect(!r.ok && r.error).toBe("invalid_input");
  });
});
