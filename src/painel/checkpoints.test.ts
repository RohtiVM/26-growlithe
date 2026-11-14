import { describe, expect, it } from "vitest";
import { CheckpointId, StoreId, UserId, type PainelAccess } from "@/domain/schemas";
import { checkpointFromRow, checkpointScanUrl, createCheckpoint, printedQrExpiry } from "./checkpoints";

const ADMIN: PainelAccess = {
  kind: "staff",
  staff: { role: "admin", userId: UserId.parse("7d0e4c4a-1f2b-4c3d-8e9f-0a1b2c3d4e5f") },
};
const LOJISTA: PainelAccess = {
  kind: "staff",
  staff: {
    role: "lojista",
    userId: UserId.parse("7d0e4c4a-1f2b-4c3d-8e9f-0a1b2c3d4e5f"),
    storeId: StoreId.parse("1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed"),
  },
};
const ROW = {
  id: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
  store_id: null,
  label: "Entrada principal",
  dynamic_qr: false,
  active: true,
};

/** Banco falso: guarda o que foi inserido e devolve a linha ou um erro do Postgres. */
const fakeInsert = (result: { row: unknown } | { code: string }) => {
  const calls: unknown[] = [];
  const insert = async (values: unknown) => {
    calls.push(values);
    return "row" in result ? { data: result.row, error: null } : { data: null, error: { code: result.code } };
  };
  return { insert, calls };
};

describe("checkpointFromRow (borda do banco)", () => {
  it("converte a linha do banco para o domínio", () => {
    expect(checkpointFromRow(ROW)).toEqual({
      id: CheckpointId.parse(ROW.id),
      storeId: null,
      label: "Entrada principal",
      dynamicQr: false,
      active: true,
    });
  });

  it("recusa linha malformada", () => {
    expect(() => checkpointFromRow({ ...ROW, id: "x" })).toThrow();
  });
});

describe("createCheckpoint (UC6, critério 3)", () => {
  it("admin cria checkpoint e o banco recebe colunas em snake_case", async () => {
    const db = fakeInsert({ row: ROW });
    const r = await createCheckpoint(ADMIN, { storeId: null, label: "  Entrada principal ", dynamicQr: false }, db.insert);
    expect(r).toEqual({ ok: true, data: checkpointFromRow(ROW) });
    expect(db.calls).toEqual([{ store_id: null, label: "Entrada principal", dynamic_qr: false }]);
  });

  it("lojista recebe forbidden e nada é gravado", async () => {
    const db = fakeInsert({ row: ROW });
    const r = await createCheckpoint(LOJISTA, { storeId: null, label: "Palco", dynamicQr: false }, db.insert);
    expect(r).toMatchObject({ ok: false, error: "forbidden" });
    expect(db.calls).toEqual([]);
  });

  it("sem sessão recebe not_authenticated", async () => {
    const db = fakeInsert({ row: ROW });
    const r = await createCheckpoint({ kind: "anonymous" }, { storeId: null, label: "Palco", dynamicQr: false }, db.insert);
    expect(r).toMatchObject({ ok: false, error: "not_authenticated" });
    expect(db.calls).toEqual([]);
  });

  it("nome vazio é invalid_input com a mensagem do campo", async () => {
    const db = fakeInsert({ row: ROW });
    const r = await createCheckpoint(ADMIN, { storeId: null, label: " ", dynamicQr: false }, db.insert);
    expect(r).toMatchObject({ ok: false, error: "invalid_input" });
    expect(!r.ok && r.message).toContain("Dê um nome");
    expect(db.calls).toEqual([]);
  });

  it("nome repetido na mesma loja vira duplicate_label (UC6)", async () => {
    const db = fakeInsert({ code: "23505" });
    const r = await createCheckpoint(ADMIN, { storeId: null, label: "Entrada principal", dynamicQr: false }, db.insert);
    expect(r).toMatchObject({ ok: false, error: "duplicate_label" });
  });

  it("outro erro do banco vira save_failed, sem vazar detalhe", async () => {
    const db = fakeInsert({ code: "XX000" });
    const r = await createCheckpoint(ADMIN, { storeId: null, label: "Palco", dynamicQr: false }, db.insert);
    expect(r).toMatchObject({ ok: false, error: "save_failed" });
  });
});

describe("QR impresso (critério 13)", () => {
  it("vale por 1 ano a partir de agora, em segundos Unix", () => {
    const now = new Date("2026-11-14T10:00:00Z");
    expect(printedQrExpiry(now)).toBe(Math.floor(now.getTime() / 1000) + 365 * 24 * 60 * 60);
  });

  it("aponta para /s/<token> no endereço do app", () => {
    expect(checkpointScanUrl("https://growlithe.vercel.app", "abc_-1")).toBe("https://growlithe.vercel.app/s/abc_-1");
    expect(checkpointScanUrl("http://localhost:3000/", "abc")).toBe("http://localhost:3000/s/abc");
  });
});
