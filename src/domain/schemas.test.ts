import { describe, expect, it } from "vitest";
import { NfceAccessKey, NfceQrUrl, tierFromPoints } from "./schemas";

/** Módulo 11 da chave de acesso, escrito de novo aqui para não testar o código com ele mesmo. */
const withCheckDigit = (first43: string): string => {
  let sum = 0;
  for (let i = 0; i < first43.length; i++) {
    const fromRight = first43.length - 1 - i;
    sum += (first43.charCodeAt(i) - 48) * ((fromRight % 8) + 2);
  }
  const rest = sum % 11;
  return first43 + String(rest < 2 ? 0 : 11 - rest);
};

// cUF 17 (TO), 2611, CNPJ, modelo 65, série 001, número, tpEmis 1, código.
const VALID_KEY = withCheckDigit("17" + "2611" + "12345678000195" + "65" + "001" + "000000123" + "1" + "12345678");

describe("tierFromPoints", () => {
  it.each([
    [0, "bronze"],
    [499, "bronze"],
    [500, "prata"],
    [1_999, "prata"],
    [2_000, "ouro"],
    [5_000, "diamante"],
    [99_999, "diamante"],
  ])("%i pontos históricos → %s", (points, tier) => {
    expect(tierFromPoints(points)).toBe(tier);
  });
});

describe("NfceAccessKey", () => {
  it("decompõe uma chave válida de NFC-e", () => {
    const key = NfceAccessKey.parse(VALID_KEY);
    expect(key).toMatchObject({ uf: "17", issuedYear: 2026, issuedMonth: 11, cnpj: "12345678000195" });
  });

  it("recusa dígito verificador errado", () => {
    const last = Number(VALID_KEY.slice(-1));
    const wrong = VALID_KEY.slice(0, 43) + String((last + 1) % 10);
    expect(NfceAccessKey.safeParse(wrong).success).toBe(false);
  });

  it("recusa nota que não é modelo 65", () => {
    const nfe = withCheckDigit("17" + "2611" + "12345678000195" + "55" + "001" + "000000123" + "1" + "12345678");
    expect(NfceAccessKey.safeParse(nfe).success).toBe(false);
  });
});

describe("NfceQrUrl", () => {
  it("extrai a chave do parâmetro p do QR do cupom fiscal", () => {
    const url = `https://www.sefaz.to.gov.br/nfce/qrcode?p=${VALID_KEY}|2|1|1|ABCDEF`;
    expect(NfceQrUrl.parse(url).raw).toBe(VALID_KEY);
  });

  it("recusa QR que não é de cupom fiscal", () => {
    expect(NfceQrUrl.safeParse("https://example.com/promo").success).toBe(false);
    expect(NfceQrUrl.safeParse("texto qualquer").success).toBe(false);
  });
});
