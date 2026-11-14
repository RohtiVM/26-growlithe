import { describe, expect, it } from "vitest";
import { hourInPalmas, isHeavyRain, parseEasterOverride, resolveEasterEgg } from "./egg";

// Palmas é UTC−3, sem horário de verão.
const at = (hhmm: string): Date => new Date(`2026-11-13T${hhmm}:00-03:00`);

describe("hourInPalmas (D1)", () => {
  it("usa o fuso de Palmas, não o do servidor", () => {
    expect(hourInPalmas(new Date("2026-11-14T05:30:00Z"))).toBe(2);
    expect(hourInPalmas(at("23:59"))).toBe(23);
  });
});

describe("isHeavyRain (D5)", () => {
  it("chuva forte por volume ou por código", () => {
    expect(isHeavyRain({ precipitation: 3, weatherCode: 61 })).toBe(true);
    expect(isHeavyRain({ precipitation: 0.4, weatherCode: 65 })).toBe(true);
    expect(isHeavyRain({ precipitation: 0, weatherCode: 95 })).toBe(true);
  });

  it("garoa e céu limpo não contam", () => {
    expect(isHeavyRain({ precipitation: 0.5, weatherCode: 61 })).toBe(false);
    expect(isHeavyRain({ precipitation: 0, weatherCode: 0 })).toBe(false);
  });
});

describe("resolveEasterEgg (critérios 1–5, D8)", () => {
  const dry = { precipitation: 0, weatherCode: 1 };
  const storm = { precipitation: 8, weatherCode: 82 };

  it("madrugada mostra o mascote", () => {
    expect(resolveEasterEgg({ now: at("02:00"), weather: dry, override: null })).toBe("noite");
    expect(resolveEasterEgg({ now: at("00:00"), weather: dry, override: null })).toBe("noite");
    expect(resolveEasterEgg({ now: at("05:59"), weather: dry, override: null })).toBe("noite");
  });

  it("a partir das 6h o mascote não aparece", () => {
    expect(resolveEasterEgg({ now: at("06:00"), weather: dry, override: null })).toBeNull();
    expect(resolveEasterEgg({ now: at("17:00"), weather: dry, override: null })).toBeNull();
  });

  it("chuva forte de dia ativa a chuva", () => {
    expect(resolveEasterEgg({ now: at("15:00"), weather: storm, override: null })).toBe("chuva");
  });

  it("madrugada vence a chuva", () => {
    expect(resolveEasterEgg({ now: at("03:00"), weather: storm, override: null })).toBe("noite");
  });

  it("sem clima (API falhou) não há chuva", () => {
    expect(resolveEasterEgg({ now: at("15:00"), weather: null, override: null })).toBeNull();
  });

  it("o parâmetro de demonstração força o efeito", () => {
    expect(resolveEasterEgg({ now: at("17:00"), weather: dry, override: "noite" })).toBe("noite");
    expect(resolveEasterEgg({ now: at("17:00"), weather: null, override: "chuva" })).toBe("chuva");
  });
});

describe("parseEasterOverride (D7)", () => {
  it("aceita só os valores conhecidos", () => {
    expect(parseEasterOverride("noite")).toBe("noite");
    expect(parseEasterOverride("chuva")).toBe("chuva");
    expect(parseEasterOverride("<script>")).toBeNull();
    expect(parseEasterOverride(undefined)).toBeNull();
    expect(parseEasterOverride(["noite", "chuva"])).toBe("noite");
  });
});
