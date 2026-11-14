/**
 * Checkpoints no painel (spec 003, ticket T5). Regras puras: o servidor injeta
 * o acesso de quem chamou e a função que grava no banco.
 */
import {
  CHECKPOINT_ERROR_MESSAGES,
  CheckpointRow,
  CreateCheckpointInput,
  type Checkpoint,
  type CheckpointError,
  type PainelAccess,
  type PainelAuthError,
  type Result,
} from "@/domain/schemas";
import { requireStaffRole } from "./access";

export type CreateCheckpointError = PainelAuthError | CheckpointError | "invalid_input";

/** Resposta mínima do cliente Supabase que nos interessa. */
type InsertResult = { data: unknown; error: { code?: string } | null };
export type InsertCheckpoint = (values: {
  store_id: string | null;
  label: string;
  dynamic_qr: boolean;
}) => Promise<InsertResult>;

/** Violação de UNIQUE no Postgres: `checkpoints_label_per_store`. */
const UNIQUE_VIOLATION = "23505";

const QR_PRINTED_VALIDITY_SECONDS = 365 * 24 * 60 * 60;

export const checkpointFromRow = (row: unknown): Checkpoint => CheckpointRow.parse(row);

const fail = (error: CheckpointError): Result<never, CheckpointError> => ({
  ok: false,
  error,
  message: CHECKPOINT_ERROR_MESSAGES[error],
});

/** UC6: só o admin cadastra. Critério 3: a checagem acontece antes de qualquer gravação. */
export const createCheckpoint = async (
  access: PainelAccess,
  raw: unknown,
  insert: InsertCheckpoint,
): Promise<Result<Checkpoint, CreateCheckpointError>> => {
  const allowed = requireStaffRole(access, ["admin"]);
  if (!allowed.ok) return allowed;

  const parsed = CreateCheckpointInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "invalid_input", message: parsed.error.issues[0]?.message ?? "Confira os campos" };
  }

  const { data, error } = await insert({
    store_id: parsed.data.storeId,
    label: parsed.data.label,
    dynamic_qr: parsed.data.dynamicQr,
  });
  if (error !== null) return fail(error.code === UNIQUE_VIOLATION ? "duplicate_label" : "save_failed");

  const row = CheckpointRow.safeParse(data);
  return row.success ? { ok: true, data: row.data } : fail("save_failed");
};

/** Validade do QR impresso, em segundos Unix. Reimprimir depois de 1 ano. */
export const printedQrExpiry = (now: Date): number =>
  Math.floor(now.getTime() / 1000) + QR_PRINTED_VALIDITY_SECONDS;

/** Link universal do QR (docs/08): a câmera nativa abre o app sem instalar nada. */
export const checkpointScanUrl = (origin: string, token: string): string =>
  `${origin.replace(/\/+$/, "")}/s/${token}`;
