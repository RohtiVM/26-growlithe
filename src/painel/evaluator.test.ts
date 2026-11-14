import { describe, expect, it } from "vitest";
import { EVALUATOR_UNTIL, evaluatorRoleExpired, isEvaluatorWindowOpen } from "./evaluator";

describe("prazo do modo avaliador (spec 008, D3)", () => {
  it("vai até 15/11/2026 às 23h59 em Palmas", () => {
    expect(EVALUATOR_UNTIL.toISOString()).toBe("2026-11-16T02:59:59.000Z");
  });

  it("aberto antes do prazo, fechado depois", () => {
    expect(isEvaluatorWindowOpen(new Date("2026-11-14T13:00:00Z"))).toBe(true);
    expect(isEvaluatorWindowOpen(new Date("2026-11-16T02:59:59Z"))).toBe(false);
    expect(isEvaluatorWindowOpen(new Date("2026-11-20T12:00:00Z"))).toBe(false);
  });
});

describe("evaluatorRoleExpired (critério 4)", () => {
  const now = new Date("2026-11-16T03:00:00Z");

  it("conta sem prazo (admin de verdade) nunca expira", () => {
    expect(evaluatorRoleExpired(null, now)).toBe(false);
  });

  it("avaliador perde o papel depois do prazo", () => {
    expect(evaluatorRoleExpired("2026-11-16T02:59:59Z", now)).toBe(true);
    expect(evaluatorRoleExpired("2026-11-17T00:00:00Z", now)).toBe(false);
  });

  it("data estranha é tratada como vencida (nunca dá acesso por engano)", () => {
    expect(evaluatorRoleExpired("não é data", now)).toBe(true);
  });
});
