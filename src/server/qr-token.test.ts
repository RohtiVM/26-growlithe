import { describe, expect, it } from "vitest";
import { CheckpointId, QrPayload } from "@/domain/schemas";
import { QrSigningSecret, signQrToken, verifyQrToken } from "./qr-token";

const SECRET = QrSigningSecret.parse("s".repeat(32));
const OTHER = QrSigningSecret.parse("o".repeat(32));
const CP = CheckpointId.parse("3f2504e0-4f89-41d3-9a0c-0305e82c3301");
const NOW = new Date("2026-11-14T10:00:00Z");
const IN_ONE_HOUR = Math.floor(NOW.getTime() / 1000) + 3600;

const decode = (token: string): unknown => JSON.parse(Buffer.from(token, "base64url").toString("utf8"));
const payloadOf = (token: string): QrPayload => QrPayload.parse(decode(token));
const encode = (value: unknown): string => Buffer.from(JSON.stringify(value)).toString("base64url");

describe("QrSigningSecret (RNF04)", () => {
  it("exige 32+ caracteres", () => {
    expect(QrSigningSecret.safeParse("curto").success).toBe(false);
    expect(QrSigningSecret.safeParse("x".repeat(32)).success).toBe(true);
  });
});

describe("signQrToken / verifyQrToken", () => {
  it("o token assinado volta como o mesmo checkpoint (critério 13)", () => {
    const token = signQrToken(CP, IN_ONE_HOUR, SECRET);
    expect(verifyQrToken(token, SECRET, NOW)).toEqual({ ok: true, data: CP });
  });

  it("o token é base64url, cabe numa URL e segue o formato da docs/08", () => {
    const token = signQrToken(CP, IN_ONE_HOUR, SECRET);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decode(token)).toMatchObject({ v: 1, cp: CP, exp: IN_ONE_HOUR });
  });

  it("assinatura alterada é recusada (critério 14)", () => {
    const payload = { ...payloadOf(signQrToken(CP, IN_ONE_HOUR, SECRET)), sig: "0".repeat(64) };
    expect(verifyQrToken(encode(payload), SECRET, NOW)).toMatchObject({ ok: false, error: "invalid_qr" });
  });

  it("trocar o checkpoint mantendo a assinatura é recusado", () => {
    const payload = { ...payloadOf(signQrToken(CP, IN_ONE_HOUR, SECRET)), cp: "9c858901-8a57-4791-81fe-4c455b099bc9" };
    expect(verifyQrToken(encode(payload), SECRET, NOW)).toMatchObject({ ok: false, error: "invalid_qr" });
  });

  it("estender a validade mantendo a assinatura é recusado", () => {
    const payload = { ...payloadOf(signQrToken(CP, IN_ONE_HOUR, SECRET)), exp: IN_ONE_HOUR + 999_999 };
    expect(verifyQrToken(encode(payload), SECRET, NOW)).toMatchObject({ ok: false, error: "invalid_qr" });
  });

  it("token assinado com outro segredo é recusado", () => {
    expect(verifyQrToken(signQrToken(CP, IN_ONE_HOUR, OTHER), SECRET, NOW)).toMatchObject({ ok: false, error: "invalid_qr" });
  });

  it("token vencido é recusado como expirado", () => {
    const past = Math.floor(NOW.getTime() / 1000) - 1;
    expect(verifyQrToken(signQrToken(CP, past, SECRET), SECRET, NOW)).toMatchObject({ ok: false, error: "expired_qr" });
  });

  it("lixo, JSON inválido e campos faltando viram invalid_qr sem lançar exceção", () => {
    for (const junk of ["", "%%%", encode("texto"), encode({ v: 1 }), encode({ v: 2, cp: CP, exp: IN_ONE_HOUR, sig: "a".repeat(64) })]) {
      expect(verifyQrToken(junk, SECRET, NOW)).toMatchObject({ ok: false, error: "invalid_qr" });
    }
  });

  it("toda recusa traz a mensagem do SCAN_ERROR_MESSAGES", () => {
    const r = verifyQrToken("%%%", SECRET, NOW);
    expect(!r.ok && r.message).toBe("Esse QR Code não é do Growlithe.");
  });
});
