import { describe, expect, it } from "vitest";
import { scanOutcomeFromRow, tierProgress, VisitorNameInput } from "./scan";

const ok = {
  result: "ok",
  checkpoint: "Entrada principal",
  is_checkin: true,
  base_points: 20,
  points_earned: 20,
  points_balance: 520,
  lifetime_before: 490,
  lifetime_after: 510,
  missions: [],
};

describe("tierProgress (Home e resultado)", () => {
  it("mostra quanto falta para o próximo nível", () => {
    expect(tierProgress(1240)).toEqual({ tier: "prata", next: "ouro", missing: 760, percent: 49 });
  });

  it("começa no bronze com 0 pontos", () => {
    expect(tierProgress(0)).toEqual({ tier: "bronze", next: "prata", missing: 500, percent: 0 });
  });

  it("diamante não tem próximo nível", () => {
    expect(tierProgress(9000)).toEqual({ tier: "diamante", next: null, missing: 0, percent: 100 });
  });
});

describe("scanOutcomeFromRow (borda do banco → tela)", () => {
  it("sucesso de check-in com subida de nível (critérios 1 e 9)", () => {
    const r = scanOutcomeFromRow(ok);
    expect(r).toMatchObject({
      kind: "success",
      checkpoint: "Entrada principal",
      isCheckin: true,
      pointsEarned: 20,
      balance: 520,
      tierUp: "prata",
      progress: { tier: "prata", next: "ouro", missing: 1490 },
    });
  });

  it("sem cruzar limiar não há subida de nível", () => {
    const r = scanOutcomeFromRow({ ...ok, lifetime_before: 100, lifetime_after: 120 });
    expect(r).toMatchObject({ kind: "success", tierUp: null });
  });

  it("missões: concluída, em progresso e fora de ordem (critérios 7 e 8)", () => {
    const r = scanOutcomeFromRow({
      ...ok,
      missions: [
        { title: "Relâmpago", status: "completed", current: 1, target: 1, points: 100 },
        { title: "Caça A", status: "progress", current: 1, target: 3 },
        { title: "Caça B", status: "out_of_order", current: 0, target: 2, expected: 1, scanned: 2 },
      ],
    });
    expect(r.kind === "success" && r.missions.map((m) => m.status)).toEqual(["completed", "progress", "out_of_order"]);
  });

  it.each([
    ["already_scanned_today", "Você já escaneou este ponto hoje. Volte amanhã!"],
    ["invalid_qr", "Esse QR Code não é do Growlithe."],
    ["expired_qr", "Esse QR Code expirou. Peça um novo na loja."],
    ["not_authenticated", "Entre na sua conta para ganhar pontos."],
  ])("erro %s vira a mensagem do domínio (critérios 2–4)", (result, message) => {
    expect(scanOutcomeFromRow({ result, checkpoint: "X" })).toEqual({ kind: "error", error: result, message });
  });

  it("resposta estranha do banco vira invalid_qr, nunca exceção", () => {
    expect(scanOutcomeFromRow({ result: "hackeado" })).toMatchObject({ kind: "error", error: "invalid_qr" });
    expect(scanOutcomeFromRow(null)).toMatchObject({ kind: "error", error: "invalid_qr" });
  });
});

describe("VisitorNameInput (critério 6)", () => {
  it("apara e exige de 2 a 80 caracteres", () => {
    expect(VisitorNameInput.parse({ name: "  Marina  " })).toEqual({ name: "Marina" });
    expect(VisitorNameInput.safeParse({ name: " a " }).success).toBe(false);
  });
});
