/**
 * Verificação de cupom fiscal (NFC-e) — porta + adaptadores.
 *
 * O resto do sistema só conhece a interface `ReceiptVerifier`. Trocar a
 * verificação local pela consulta na SEFAZ (via Infosimples) é mudar UMA
 * linha na composição, sem tocar em Server Actions nem em telas.
 */
import { z } from "zod";
import { NfceQrUrl, type NfceAccessKey, type Result } from "../domain/schemas";

/* ------------------------------------------------------------------ */
/* Contrato                                                            */
/* ------------------------------------------------------------------ */

export type ReceiptItem = { name: string; totalCents: number };

/**
 * O que sabemos depende de onde veio a verificação — e o tipo diz isso.
 * Só existe `items` quando a SEFAZ foi consultada.
 */
export type VerifiedReceipt =
  | { source: "local"; key: NfceAccessKey }
  | {
      source: "sefaz";
      key: NfceAccessKey;
      issuedAt: Date;
      totalCents: number;
      items: ReceiptItem[];
    };

export type VerifyError = "invalid_receipt" | "receipt_canceled" | "sefaz_unavailable";

export interface ReceiptVerifier {
  verify(qrUrl: string): Promise<Result<VerifiedReceipt, VerifyError>>;
}

/* ------------------------------------------------------------------ */
/* Adaptador 1 — local (MVP): só a chave de acesso, sem rede           */
/* ------------------------------------------------------------------ */

export const localVerifier: ReceiptVerifier = {
  async verify(qrUrl) {
    const parsed = NfceQrUrl.safeParse(qrUrl);
    if (!parsed.success) {
      return {
        ok: false,
        error: "invalid_receipt",
        message: parsed.error.issues[0]?.message ?? "Cupom inválido",
      };
    }
    return { ok: true, data: { source: "local", key: parsed.data } };
  },
};

/* ------------------------------------------------------------------ */
/* Adaptador 2 — SEFAZ via API da Infosimples                          */
/* ------------------------------------------------------------------ */

/**
 * Só os campos que usamos. Nomes vêm da página da consulta NFC-e da
 * Infosimples; CONFIRMAR o formato exato no teste grátis antes da demo.
 * Se a resposta divergir, o Zod falha com mensagem clara — e caímos no
 * fallback local em vez de quebrar a tela.
 */
const InfosimplesNfce = z.object({
  cancelada: z.boolean(),
  normalizado_valor_total: z.number(),
  informacoes_nota: z.object({
    data_emissao: z.string(), // ex.: "13/11/2026"
    hora_emissao: z.string(), // ex.: "14:32:10"
  }),
  produtos: z.array(
    z.object({
      nome: z.string(),
      normalizado_valor_total_produto: z.number(),
    }),
  ),
});

const InfosimplesResponse = z.object({
  code: z.number(),
  data: z.array(InfosimplesNfce),
});

const BR_DATE = /^(\d{2})\/(\d{2})\/(\d{4})$/;

const parseBrDateTime = (date: string, time: string): Date | null => {
  const m = BR_DATE.exec(date);
  if (m === null) return null;
  const [, dd, mm, yyyy] = m;
  const d = new Date(`${yyyy}-${mm}-${dd}T${time}-03:00`);
  return Number.isNaN(d.getTime()) ? null : d;
};

const toCents = (reais: number): number => Math.round(reais * 100);

export const createInfosimplesVerifier = (opts: {
  token: string;
  /** Endpoint da consulta NFC-e (unificada ou do estado). Confirmar na documentação. */
  endpoint: string;
  timeoutMs?: number;
}): ReceiptVerifier => ({
  async verify(qrUrl) {
    const local = await localVerifier.verify(qrUrl);
    if (!local.ok) return local;
    const { key } = local.data;

    const unavailable = (message: string): Result<never, VerifyError> => ({
      ok: false,
      error: "sefaz_unavailable",
      message,
    });

    let json: unknown;
    try {
      const res = await fetch(opts.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token: opts.token, nfce: key.raw }),
        signal: AbortSignal.timeout(opts.timeoutMs ?? 8_000),
      });
      json = await res.json();
    } catch {
      return unavailable("Consulta à SEFAZ indisponível no momento");
    }

    const parsed = InfosimplesResponse.safeParse(json);
    const nota = parsed.success && parsed.data.code === 200 ? parsed.data.data[0] : undefined;
    if (nota === undefined) return unavailable("Resposta inesperada da consulta");

    if (nota.cancelada) {
      return { ok: false, error: "receipt_canceled", message: "Esse cupom foi cancelado" };
    }

    const issuedAt = parseBrDateTime(
      nota.informacoes_nota.data_emissao,
      nota.informacoes_nota.hora_emissao,
    );
    if (issuedAt === null) return unavailable("Data de emissão ilegível");

    return {
      ok: true,
      data: {
        source: "sefaz",
        key,
        issuedAt,
        totalCents: toCents(nota.normalizado_valor_total),
        items: nota.produtos.map((p) => ({
          name: p.nome,
          totalCents: toCents(p.normalizado_valor_total_produto),
        })),
      },
    };
  },
});

/* ------------------------------------------------------------------ */
/* Composição — SEFAZ quando dá, local quando a SEFAZ cai              */
/* ------------------------------------------------------------------ */

export const withFallback = (
  primary: ReceiptVerifier,
  fallback: ReceiptVerifier,
): ReceiptVerifier => ({
  async verify(qrUrl) {
    const first = await primary.verify(qrUrl);
    if (!first.ok && first.error === "sefaz_unavailable") return fallback.verify(qrUrl);
    return first;
  },
});

/* ------------------------------------------------------------------ */
/* Regra da missão — funciona com os dois níveis de informação         */
/* ------------------------------------------------------------------ */

export type ReceiptCheck =
  | { ok: true }
  | { ok: false; reason: "receipt_outside_window" | "below_minimum" };

export const checkReceiptForMission = (
  receipt: VerifiedReceipt,
  mission: { startsAt: Date; endsAt: Date; minAmountCents: number | null },
): ReceiptCheck => {
  switch (receipt.source) {
    case "local": {
      // Só temos mês/ano: aceita se o mês da nota cai dentro da janela.
      const keyMonth = receipt.key.issuedYear * 12 + (receipt.key.issuedMonth - 1);
      const startMonth = mission.startsAt.getFullYear() * 12 + mission.startsAt.getMonth();
      const endMonth = mission.endsAt.getFullYear() * 12 + mission.endsAt.getMonth();
      return keyMonth >= startMonth && keyMonth <= endMonth
        ? { ok: true }
        : { ok: false, reason: "receipt_outside_window" };
    }
    case "sefaz": {
      // Data e hora exatas + valor: regra completa.
      if (receipt.issuedAt < mission.startsAt || receipt.issuedAt > mission.endsAt) {
        return { ok: false, reason: "receipt_outside_window" };
      }
      if (mission.minAmountCents !== null && receipt.totalCents < mission.minAmountCents) {
        return { ok: false, reason: "below_minimum" };
      }
      return { ok: true };
    }
    default: {
      const _exhaustive: never = receipt;
      return _exhaustive;
    }
  }
};
