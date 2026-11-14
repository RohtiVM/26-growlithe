/**
 * Regras de acesso ao painel (spec 003, ticket T3). Funções puras: o servidor
 * lê a sessão e a linha de `profiles`, e estas funções decidem.
 */
import {
  PAINEL_AUTH_MESSAGES,
  assertNever,
  StaffProfileRow,
  type PainelAccess,
  type PainelAuthError,
  type Result,
  type StaffMember,
  type StaffRole,
} from "@/domain/schemas";

/** `null` = sem sessão. Qualquer linha estranha vira `no_access`, nunca acesso. */
export const painelAccess = (row: unknown): PainelAccess => {
  if (row === null) return { kind: "anonymous" };
  const parsed = StaffProfileRow.safeParse(row);
  if (!parsed.success || parsed.data === null) return { kind: "no_access" };
  return { kind: "staff", staff: parsed.data };
};

/** Critério 2: o lojista só tem a tela de validar cupom de resgate. */
export const painelHomePath = (staff: StaffMember): "/painel" | "/painel/validar" => {
  switch (staff.role) {
    case "admin":
      return "/painel";
    case "lojista":
      return "/painel/validar";
    default:
      return assertNever(staff);
  }
};

/** Critério 3 / RNF01: toda ação do servidor chama isto antes de agir. */
export const requireStaffRole = (
  access: PainelAccess,
  roles: readonly StaffRole[],
): Result<StaffMember, PainelAuthError> => {
  const refuse = (error: PainelAuthError): Result<StaffMember, PainelAuthError> => ({
    ok: false,
    error,
    message: PAINEL_AUTH_MESSAGES[error],
  });
  switch (access.kind) {
    case "anonymous":
      return refuse("not_authenticated");
    case "no_access":
      return refuse("forbidden");
    case "staff":
      return roles.includes(access.staff.role) ? { ok: true, data: access.staff } : refuse("forbidden");
    default:
      return assertNever(access);
  }
};

/**
 * Destino depois do link mágico: só caminhos internos conhecidos (evita
 * redirecionamento aberto). Painel, app do visitante e a volta para o scan
 * (`/s/<token>`, spec 004 D1).
 */
const SAFE_NEXT = [/^\/painel(\/[A-Za-z0-9/_-]*)?$/, /^\/app(\/[A-Za-z0-9_-]+)*$/, /^\/s\/[A-Za-z0-9_-]+$/] as const;

export const safeNextPath = (next: string | null): string =>
  next !== null && SAFE_NEXT.some((re) => re.test(next)) ? next : "/painel";
