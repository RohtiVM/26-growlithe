import { describe, expect, it } from "vitest";
import { parseVariant, pickVariant } from "./ab-test";

describe("teste A/B de manchete", () => {
  it("sorteia A ou B meio a meio", () => {
    expect(pickVariant(() => 0.1)).toBe("A");
    expect(pickVariant(() => 0.9)).toBe("B");
  });

  it("aceita só variantes conhecidas no cookie", () => {
    expect(parseVariant("A")).toBe("A");
    expect(parseVariant("B")).toBe("B");
    expect(parseVariant("C")).toBeNull();
    expect(parseVariant(undefined)).toBeNull();
  });
});
