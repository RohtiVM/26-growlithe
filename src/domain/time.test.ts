import { describe, expect, it } from "vitest";
import { currentStreak, isMallOpen, localDay, previousDay } from "./time";

describe("tempo no fuso do shopping", () => {
  it("usa o dia de Palmas, não o UTC", () => {
    // 01:30 UTC do dia 14 ainda é dia 13 no Tocantins.
    expect(localDay(new Date("2026-11-14T01:30:00Z"))).toBe("2026-11-13");
  });

  it("volta um dia atravessando o mês", () => {
    expect(previousDay("2026-12-01")).toBe("2026-11-30");
  });

  it("conta a sequência e mantém a de ontem viva", () => {
    const days = ["2026-11-11", "2026-11-12"];
    expect(currentStreak(days, "2026-11-13")).toBe(2);
    expect(currentStreak([...days, "2026-11-13"], "2026-11-13")).toBe(3);
    expect(currentStreak(["2026-11-10"], "2026-11-13")).toBe(0);
  });

  it("respeita o horário do shopping", () => {
    const hours = { open: 10, close: 22 };
    expect(isMallOpen(new Date("2026-11-13T09:59:00-03:00"), hours)).toBe(false);
    expect(isMallOpen(new Date("2026-11-13T10:00:00-03:00"), hours)).toBe(true);
    expect(isMallOpen(new Date("2026-11-13T22:00:00-03:00"), hours)).toBe(false);
  });
});
