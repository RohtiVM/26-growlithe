/**
 * Validar cupom de resgate no painel (spec 003, tickets T7/T8). Regras puras:
 * o servidor injeta o acesso de quem chamou e a chamada à função Postgres.
 * A decisão final (loja, validade, uso único) é da função no banco, atômica.
 */
import {
  PAINEL_AUTH_MESSAGES,
  assertNever,
  RedemptionCode,
  RedemptionPreviewRow,
  RedemptionValidateRow,
  redemptionLookupMessage,
  type PainelAccess,
  type PainelAuthError,
  type RedemptionLookupError,
  type RedemptionPreview,
  type RedemptionRefusal,
  type Result,
} from "@/domain/schemas";
import { requireStaffRole } from "./access";

export type RedemptionActionError = PainelAuthError | RedemptionLookupError | "invalid_input" | "unavailable";

/** Resposta mínima do `supabase.rpc(...)` que nos interessa. */
type RpcResult = { data: unknown; error: { code?: string } | null };
export type RedemptionRpc = (code: RedemptionCode) => Promise<RpcResult>;

export type PreviewedRedemption = RedemptionPreview & { code: RedemptionCode };

/** A função Postgres recusa quem não tem papel com `insufficient_privilege`. */
const INSUFFICIENT_PRIVILEGE = "42501";

const UNAVAILABLE_MESSAGE = "Não conseguimos conferir agora. Tente de novo em instantes.";

type Fail = { ok: false; error: RedemptionActionError; message: string };

const unavailable: Fail = { ok: false, error: "unavailable", message: UNAVAILABLE_MESSAGE };

const refused = (r: RedemptionRefusal): Fail => ({
  ok: false,
  error: r.error,
  message: redemptionLookupMessage(r.error, r.redeemedAt),
});

/** Papel antes de tudo (RNF01), depois a entrada (RNF06). Só então o banco. */
const guard = (access: PainelAccess, raw: unknown): Result<RedemptionCode, RedemptionActionError> => {
  const allowed = requireStaffRole(access, ["admin", "lojista"]);
  if (!allowed.ok) return allowed;
  const code = RedemptionCode.safeParse(raw);
  if (!code.success) {
    return { ok: false, error: "invalid_input", message: code.error.issues[0]?.message ?? "Confira o código" };
  }
  return { ok: true, data: code.data };
};

const rpcFailure = (error: { code?: string }): Fail =>
  error.code === INSUFFICIENT_PRIVILEGE
    ? { ok: false, error: "forbidden", message: PAINEL_AUTH_MESSAGES.forbidden }
    : unavailable;

/** Critério 15: mostra benefício, primeiro nome e nível antes de confirmar. Não altera nada. */
export const previewRedemption = async (
  access: PainelAccess,
  raw: unknown,
  rpc: RedemptionRpc,
): Promise<Result<PreviewedRedemption, RedemptionActionError>> => {
  const code = guard(access, raw);
  if (!code.ok) return code;

  const { data, error } = await rpc(code.data);
  if (error !== null) return rpcFailure(error);

  const row = RedemptionPreviewRow.safeParse(data);
  if (!row.success) return unavailable;
  switch (row.data.kind) {
    case "found":
      return { ok: true, data: { ...row.data.preview, code: code.data } };
    case "refused":
      return refused(row.data);
    default:
      return assertNever(row.data);
  }
};

/** Critérios 16–19: confirma uma vez só; quem chega depois vê "já foi usado". */
export const confirmRedemption = async (
  access: PainelAccess,
  raw: unknown,
  rpc: RedemptionRpc,
): Promise<Result<{ redeemedAt: Date }, RedemptionActionError>> => {
  const code = guard(access, raw);
  if (!code.ok) return code;

  const { data, error } = await rpc(code.data);
  if (error !== null) return rpcFailure(error);

  const row = RedemptionValidateRow.safeParse(data);
  if (!row.success) return unavailable;
  switch (row.data.kind) {
    case "validated":
      return { ok: true, data: { redeemedAt: row.data.redeemedAt } };
    case "refused":
      return refused(row.data);
    default:
      return assertNever(row.data);
  }
};
