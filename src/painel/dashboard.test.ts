import { describe, expect, it } from "vitest";
import { dashboardFromRow, formatConversion } from "./dashboard";

const row = {
  checkinsToday: 3,
  uniqueVisitors7d: 2,
  scansByCheckpoint: [
    { checkpointId: "c1000000-0000-4000-8000-000000000001", label: "Entrada principal", scans: 5 },
    { checkpointId: "c1000000-0000-4000-8000-000000000002", label: "Praça", scans: 2 },
  ],
  missionsCompleted: 1,
  redemptionsValidated: 0,
  leads: { A: { visits: 40, leads: 8 }, B: { visits: 0, leads: 0 } },
};

describe("dashboardFromRow (critérios 4–7)", () => {
  it("lê os números da função do banco", () => {
    const d = dashboardFromRow(row);
    expect(d).toMatchObject({ kind: "ok", metrics: { checkinsToday: 3, uniqueVisitors7d: 2 } });
  });

  it("sem nenhum scan, sinaliza estado vazio (critério 7)", () => {
    const d = dashboardFromRow({ ...row, checkinsToday: 0, uniqueVisitors7d: 0, scansByCheckpoint: [] });
    expect(d).toMatchObject({ kind: "ok", empty: true });
  });

  it("com scans não está vazio", () => {
    expect(dashboardFromRow(row)).toMatchObject({ empty: false });
  });

  it("resposta estranha vira erro, nunca exceção", () => {
    expect(dashboardFromRow({ checkinsToday: -1 })).toEqual({ kind: "error" });
    expect(dashboardFromRow(null)).toEqual({ kind: "error" });
  });
});

describe("formatConversion (critério 6)", () => {
  it("mostra a conversão em porcentagem", () => {
    expect(formatConversion({ visits: 40, leads: 8 })).toBe("20%");
    expect(formatConversion({ visits: 3, leads: 1 })).toBe("33%");
  });

  it("sem visitas mostra traço", () => {
    expect(formatConversion({ visits: 0, leads: 0 })).toBe("—");
  });
});
