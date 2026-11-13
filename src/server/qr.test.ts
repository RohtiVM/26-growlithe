import { describe, expect, it } from "vitest";
import { CheckpointId } from "@/domain/schemas";
import { base64url } from "./crypto";
import { extractToken, manualCode, qrUrl, resolveManualCode, signQrToken, verifyQrToken } from "./qr";

const SECRET = "segredo-de-teste-com-mais-de-32-caracteres";
const CP = CheckpointId.parse("00000003-0000-4000-8000-000000000001");
const NOW = new Date("2026-11-13T15:00:00-03:00");

describe("QR Code assinado", () => {
  it("aceita um token assinado com o segredo do servidor", async () => {
    const token = await signQrToken(CP, SECRET, { now: NOW });
    expect(await verifyQrToken(token, SECRET, NOW)).toEqual({ ok: true, data: CP });
  });

  it("aceita a URL inteira impressa no QR", async () => {
    const token = await signQrToken(CP, SECRET, { now: NOW });
    const url = qrUrl("https://growlithe.app/", token);
    expect(url).toBe(`https://growlithe.app/s/${token}`);
    expect(extractToken(url)).toBe(token);
    expect((await verifyQrToken(url, SECRET, NOW)).ok).toBe(true);
  });

  it("recusa token assinado com outro segredo (QR forjado)", async () => {
    const token = await signQrToken(CP, "outro-segredo-com-mais-de-32-caracteres!!", { now: NOW });
    expect(await verifyQrToken(token, SECRET, NOW)).toMatchObject({ ok: false, error: "invalid_qr" });
  });

  it("recusa checkpoint trocado mantendo a assinatura", async () => {
    const token = await signQrToken(CP, SECRET, { now: NOW });
    const payload: unknown = JSON.parse(base64url.decode(token) ?? "null");
    const tampered = base64url.encode(
      JSON.stringify({ ...Object(payload), cp: "00000003-0000-4000-8000-000000000002" }),
    );
    expect(await verifyQrToken(tampered, SECRET, NOW)).toMatchObject({ ok: false, error: "invalid_qr" });
  });

  it("recusa QR dinâmico vencido", async () => {
    const token = await signQrToken(CP, SECRET, { now: NOW, ttlSeconds: 60 });
    const later = new Date(NOW.getTime() + 61_000);
    expect(await verifyQrToken(token, SECRET, later)).toMatchObject({ ok: false, error: "expired_qr" });
  });

  it.each(["", "abc", "https://example.com", base64url.encode("{}")])("recusa lixo: %j", async (raw) => {
    expect(await verifyQrToken(raw, SECRET, NOW)).toMatchObject({ ok: false, error: "invalid_qr" });
  });
});

describe("código manual (fallback quando a câmera falha)", () => {
  const OTHER = CheckpointId.parse("00000003-0000-4000-8000-000000000002");

  it("encontra o ponto pelo código de 8 caracteres, com ou sem hífen e minúsculas", async () => {
    const code = await manualCode(OTHER, SECRET);
    expect(code).toMatch(/^[0-9A-F]{8}$/);
    expect(await resolveManualCode(code, [CP, OTHER], SECRET)).toBe(OTHER);
    expect(await resolveManualCode(`${code.slice(0, 4)}-${code.slice(4)}`.toLowerCase(), [CP, OTHER], SECRET)).toBe(OTHER);
  });

  it("recusa código errado e não confunde com token", async () => {
    expect(await resolveManualCode("00000000", [CP, OTHER], SECRET)).toBeNull();
    expect(await resolveManualCode("um-token-qualquer", [CP], SECRET)).toBeNull();
  });
});
