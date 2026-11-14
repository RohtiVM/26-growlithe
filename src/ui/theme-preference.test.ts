import { describe, expect, it } from "vitest";
import { effectiveTheme, otherTheme, parseStoredTheme } from "./theme-preference";

describe("parseStoredTheme (D2, critério 4)", () => {
  it("aceita só os temas conhecidos", () => {
    expect(parseStoredTheme("claro")).toBe("claro");
    expect(parseStoredTheme("escuro")).toBe("escuro");
    expect(parseStoredTheme("roxo")).toBeNull();
    expect(parseStoredTheme(null)).toBeNull();
  });
});

describe("effectiveTheme (critérios 2 e 3)", () => {
  it("a escolha salva vence o modo do celular", () => {
    expect(effectiveTheme("claro", true)).toBe("claro");
    expect(effectiveTheme("escuro", false)).toBe("escuro");
  });

  it("sem escolha, segue o celular", () => {
    expect(effectiveTheme(null, true)).toBe("escuro");
    expect(effectiveTheme(null, false)).toBe("claro");
  });
});

describe("otherTheme (critério 1)", () => {
  it("alterna entre os dois", () => {
    expect(otherTheme("escuro")).toBe("claro");
    expect(otherTheme("claro")).toBe("escuro");
  });
});
