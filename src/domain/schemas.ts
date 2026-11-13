/**
 * Growlithe — Modelo de domínio (fonte única da verdade).
 *
 * Regras da casa:
 *  - Todo tipo é DERIVADO de um schema Zod (`z.infer`). Nunca escrevemos o tipo à mão
 *    e o schema separado — os dois não podem divergir.
 *  - Estados são uniões discriminadas: estado inválido não compila.
 *  - Zero `any`, zero `as`. Se precisou de `as`, o modelo está errado.
 */
import { z } from "zod";

/* ------------------------------------------------------------------ */
/* 1. IDs com brand — impossível passar um MissionId onde se espera   */
/*    um UserId, mesmo sendo os dois `string` em runtime.             */
/* ------------------------------------------------------------------ */

const brandedId = <const TBrand extends string>(_brand: TBrand) =>
  z.uuid().brand<TBrand>();

export const UserId = brandedId("UserId");
export type UserId = z.infer<typeof UserId>;

export const MissionId = brandedId("MissionId");
export type MissionId = z.infer<typeof MissionId>;

export const RewardId = brandedId("RewardId");
export type RewardId = z.infer<typeof RewardId>;

export const StoreId = brandedId("StoreId");
export type StoreId = z.infer<typeof StoreId>;

export const CheckpointId = brandedId("CheckpointId");
export type CheckpointId = z.infer<typeof CheckpointId>;

export const RedemptionId = brandedId("RedemptionId");
export type RedemptionId = z.infer<typeof RedemptionId>;

/* ------------------------------------------------------------------ */
/* 2. Níveis de engajamento — derivados de uma tupla `as const`.      */
/* ------------------------------------------------------------------ */

export const TIERS = ["bronze", "prata", "ouro", "diamante"] as const;
export const Tier = z.enum(TIERS);
export type Tier = z.infer<typeof Tier>;

/** `satisfies` garante que todo nível tem limiar — sem alargar o tipo. */
export const TIER_THRESHOLDS = {
  bronze: 0,
  prata: 500,
  ouro: 2_000,
  diamante: 5_000,
} as const satisfies Record<Tier, number>;

export const tierFromPoints = (lifetimePoints: number): Tier =>
  TIERS.findLast((tier) => lifetimePoints >= TIER_THRESHOLDS[tier]) ?? "bronze";

/* ------------------------------------------------------------------ */
/* 3. Usuário (visitante)                                              */
/* ------------------------------------------------------------------ */

/** Presença no shopping: `checkedInAt` só existe quando está no shopping. */
export const Presence = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("away"),
    lastVisitAt: z.coerce.date().nullable(),
  }),
  z.object({
    status: z.literal("at_mall"),
    checkedInAt: z.coerce.date(),
    entrance: z.string().min(1),
  }),
]);
export type Presence = z.infer<typeof Presence>;

/** Linha completa como existe no banco (Supabase). */
export const User = z.object({
  id: UserId,
  name: z.string().min(2).max(80),
  email: z.email(),
  phone: z
    .string()
    .regex(/^\+55\d{10,11}$/, "Telefone no formato +55DDDNUMERO")
    .nullable(),
  /** Saldo gastável em recompensas. */
  points: z.number().int().nonnegative(),
  /** Acumulado histórico — define o nível e nunca diminui. */
  lifetimePoints: z.number().int().nonnegative(),
  presence: Presence,
  marketingOptIn: z.boolean(),
  pushToken: z.string().nullable(),
  createdAt: z.coerce.date(),
  deletedAt: z.coerce.date().nullable(),
});
export type User = z.infer<typeof User>;

/** Campos que NUNCA saem do servidor (LGPD + segurança). */
const PRIVATE_USER_FIELDS = {
  phone: true,
  pushToken: true,
  marketingOptIn: true,
  deletedAt: true,
} as const;

/** O que a API expõe: sem dados privados, com o nível já calculado. */
export const UserDTO = User.omit(PRIVATE_USER_FIELDS).extend({ tier: Tier });
export type UserDTO = z.infer<typeof UserDTO>;

/**
 * `parse` funciona como allow-list: o Zod descarta chaves que não estão no
 * schema, então um campo privado não vaza nem se alguém esquecer de removê-lo.
 */
export const toUserDTO = (user: User): UserDTO =>
  UserDTO.parse({ ...user, tier: tierFromPoints(user.lifetimePoints) });

/** Formulário de "editar perfil": só o que o usuário pode mudar. */
export const UpdateProfileInput = User.pick({
  name: true,
  phone: true,
  marketingOptIn: true,
}).partial();
export type UpdateProfileInput = z.infer<typeof UpdateProfileInput>;

/* ------------------------------------------------------------------ */
/* 3b. Lojas e categorias                                              */
/* ------------------------------------------------------------------ */

export const STORE_CATEGORIES = [
  "vestuario",
  "calcados",
  "alimentacao",
  "beleza",
  "eletronicos",
  "esportes",
  "livraria",
  "casa",
  "lazer",
  "servicos",
] as const;
export const StoreCategory = z.enum(STORE_CATEGORIES);
export type StoreCategory = z.infer<typeof StoreCategory>;

/** Texto usado nas missões genéricas: "Compre uma peça de roupa". */
export const CATEGORY_LABELS = {
  vestuario: "uma peça de roupa",
  calcados: "um calçado",
  alimentacao: "uma refeição",
  beleza: "um produto de beleza",
  eletronicos: "um eletrônico ou acessório",
  esportes: "um artigo esportivo",
  livraria: "um livro ou item de papelaria",
  casa: "um item para casa",
  lazer: "um ingresso ou experiência",
  servicos: "um serviço",
} as const satisfies Record<StoreCategory, string>;

/**
 * CNPJ com 14 posições. A partir de jul/2026 o CNPJ pode ser alfanumérico
 * (12 primeiras posições com letras maiúsculas), então já aceitamos os dois.
 */
export const Cnpj = z
  .string()
  .regex(/^[0-9A-Z]{12}\d{2}$/, "CNPJ inválido")
  .brand<"Cnpj">();
export type Cnpj = z.infer<typeof Cnpj>;

export const Store = z.object({
  id: StoreId,
  name: z.string().min(2).max(80),
  /** Usado para reconhecer a loja pelo cupom fiscal. */
  cnpj: Cnpj,
  category: StoreCategory,
  active: z.boolean(),
});
export type Store = z.infer<typeof Store>;

/* ------------------------------------------------------------------ */
/* 4. Missões                                                         */
/* ------------------------------------------------------------------ */

/** Cada tipo de missão carrega SÓ os campos que fazem sentido para ele. */
export const MissionRequirement = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("qr_scan"),
    /** 1 checkpoint = missão simples; N = caça ao tesouro. */
    checkpointIds: z.array(CheckpointId).min(1),
    ordered: z.boolean(),
  }),
  z.object({
    kind: z.literal("visit_streak"),
    days: z.number().int().min(2).max(30),
  }),
  z.object({
    kind: z.literal("purchase"),
    storeId: StoreId,
    minAmountCents: z.number().int().positive(),
  }),
  z.object({
    /** "Compre uma peça de roupa em qualquer loja": validada pelo QR do cupom fiscal. */
    kind: z.literal("purchase_category"),
    category: StoreCategory,
  }),
  z.object({
    kind: z.literal("event_checkin"),
    checkpointId: CheckpointId,
    eventName: z.string().min(3),
  }),
]);
export type MissionRequirement = z.infer<typeof MissionRequirement>;
export type MissionKind = MissionRequirement["kind"];

/**
 * Como a missão chega ao visitante.
 * - "scheduled": aparece na lista de missões da semana.
 * - "flash": Missão Relâmpago — sorteada, anunciada por push, vale por pouco tempo.
 */
export const MissionLaunch = z.discriminatedUnion("type", [
  z.object({ type: z.literal("scheduled") }),
  z.object({
    type: z.literal("flash"),
    pushTitle: z.string().min(3).max(50),
    pushBody: z.string().min(3).max(120),
    /** Multiplicador de pontos para criar urgência (ex.: 2 = pontos em dobro). */
    pointsMultiplier: z.number().int().min(1).max(5),
  }),
]);
export type MissionLaunch = z.infer<typeof MissionLaunch>;

export const Mission = z.object({
  id: MissionId,
  title: z.string().min(3).max(60),
  description: z.string().max(280),
  requirement: MissionRequirement,
  pointsReward: z.number().int().positive(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  maxCompletionsPerUser: z.number().int().positive(),
  /** `null` = missão criada pelo próprio shopping. */
  storeId: StoreId.nullable(),
  launch: MissionLaunch,
  createdAt: z.coerce.date(),
});
export type Mission = z.infer<typeof Mission>;

/** Input do painel admin: o servidor gera `id` e `createdAt`. */
export const CreateMissionInput = Mission.omit({ id: true, createdAt: true }).refine(
  (m) => m.endsAt > m.startsAt,
  { message: "A missão precisa terminar depois de começar", path: ["endsAt"] },
);
export type CreateMissionInput = z.infer<typeof CreateMissionInput>;

/** Progresso de UM usuário em UMA missão. */
export const MissionProgress = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("available"),
    missionId: MissionId,
  }),
  z.object({
    status: z.literal("in_progress"),
    missionId: MissionId,
    current: z.number().int().nonnegative(),
    target: z.number().int().positive(),
    startedAt: z.coerce.date(),
  }),
  z.object({
    status: z.literal("completed"),
    missionId: MissionId,
    completedAt: z.coerce.date(),
    pointsAwarded: z.number().int().positive(),
  }),
  z.object({
    status: z.literal("expired"),
    missionId: MissionId,
    expiredAt: z.coerce.date(),
  }),
]);
export type MissionProgress = z.infer<typeof MissionProgress>;
export type MissionStatus = MissionProgress["status"];

/** Narrowing extraído da união — útil em filtros e componentes. */
export type ProgressOf<S extends MissionStatus> = Extract<MissionProgress, { status: S }>;

export const isCompleted = (p: MissionProgress): p is ProgressOf<"completed"> =>
  p.status === "completed";

/* ------------------------------------------------------------------ */
/* 5. Recompensas e resgates                                          */
/* ------------------------------------------------------------------ */

export const RewardBenefit = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("discount_percent"),
    percent: z.number().int().min(5).max(80),
    storeId: StoreId,
  }),
  z.object({
    kind: z.literal("discount_fixed"),
    amountCents: z.number().int().positive(),
    storeId: StoreId,
  }),
  z.object({
    kind: z.literal("free_parking"),
    hours: z.number().int().min(1).max(6),
  }),
  z.object({
    kind: z.literal("gift"),
    description: z.string().min(3),
    storeId: StoreId,
  }),
]);
export type RewardBenefit = z.infer<typeof RewardBenefit>;

export const Reward = z.object({
  id: RewardId,
  title: z.string().min(3).max(60),
  costPoints: z.number().int().positive(),
  benefit: RewardBenefit,
  /** `null` = estoque ilimitado. */
  stock: z.number().int().nonnegative().nullable(),
  minTier: Tier,
  active: z.boolean(),
});
export type Reward = z.infer<typeof Reward>;

const RedemptionBase = z.object({
  id: RedemptionId,
  userId: UserId,
  rewardId: RewardId,
  createdAt: z.coerce.date(),
});

/** Um cupom só tem `redeemedAt` se foi usado — o tipo garante isso. */
export const Redemption = z.discriminatedUnion("status", [
  RedemptionBase.extend({
    status: z.literal("reserved"),
    code: z.string().length(6),
    expiresAt: z.coerce.date(),
  }),
  RedemptionBase.extend({
    status: z.literal("redeemed"),
    code: z.string().length(6),
    redeemedAt: z.coerce.date(),
    validatedByStoreId: StoreId.nullable(),
  }),
  RedemptionBase.extend({
    status: z.literal("expired"),
    expiredAt: z.coerce.date(),
  }),
]);
export type Redemption = z.infer<typeof Redemption>;

/* ------------------------------------------------------------------ */
/* 6. QR Code — validação de borda (dado 100% não confiável)          */
/* ------------------------------------------------------------------ */

/** Conteúdo assinado (HMAC) dentro de cada QR impresso ou exibido. */
export const QrPayload = z.object({
  v: z.literal(1),
  cp: CheckpointId,
  /** Unix seconds. QR impresso: validade longa. QR dinâmico: ~60 s. */
  exp: z.number().int().positive(),
  sig: z.string().min(32),
});
export type QrPayload = z.infer<typeof QrPayload>;

export const ScanQrInput = z.object({
  token: z.string().min(1).max(512),
});
export type ScanQrInput = z.infer<typeof ScanQrInput>;

/* ------------------------------------------------------------------ */
/* 6b. Cupom fiscal (NFC-e) — validação de compra sem integrar lojas  */
/* ------------------------------------------------------------------ */

/**
 * Dígito verificador da chave de acesso (módulo 11, pesos 2..9 da direita
 * para a esquerda). `charCodeAt - 48` vale o próprio dígito para 0–9 e já
 * cobre o CNPJ alfanumérico.
 */
const accessKeyCheckDigit = (first43: string): number => {
  let sum = 0;
  let weight = 2;
  for (let i = first43.length - 1; i >= 0; i--) {
    sum += (first43.charCodeAt(i) - 48) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
};

/**
 * Chave de acesso de 44 posições, já decomposta:
 * cUF(2) AAMM(4) CNPJ(14) modelo(2) série(3) número(9) tpEmis(1) código(8) DV(1)
 */
export const NfceAccessKey = z
  .string()
  .regex(/^\d{6}[0-9A-Z]{12}\d{26}$/, "Chave de acesso inválida")
  .refine((k) => accessKeyCheckDigit(k.slice(0, 43)) === Number(k.slice(43)), {
    message: "Dígito verificador da chave não confere",
  })
  .refine((k) => k.slice(20, 22) === "65", {
    message: "Não é um cupom fiscal de consumidor (NFC-e modelo 65)",
  })
  .transform((k) => ({
    raw: k,
    uf: k.slice(0, 2),
    issuedYear: 2000 + Number(k.slice(2, 4)),
    issuedMonth: Number(k.slice(4, 6)),
    cnpj: Cnpj.parse(k.slice(6, 20)),
  }));
export type NfceAccessKey = z.infer<typeof NfceAccessKey>;

/**
 * Lê o QR impresso no cupom. O 1º valor do parâmetro `p` é sempre a chave
 * de acesso (QR versões 2 e 3, online ou contingência).
 */
export const NfceQrUrl = z
  .string()
  .max(1000)
  .transform((url, ctx) => {
    // Checagem dentro do transform: no Zod 4 o transform roda mesmo se um
    // `.url()` anterior falhar, e `new URL` lançaria exceção.
    const key = URL.canParse(url)
      ? new URL(url).searchParams.get("p")?.split("|")[0]
      : undefined;
    if (key === undefined) {
      ctx.addIssue({ code: "custom", message: "QR não parece ser de um cupom fiscal" });
      return z.NEVER;
    }
    return key;
  })
  .pipe(NfceAccessKey);

export const ScanReceiptInput = z.object({
  missionId: MissionId,
  qrUrl: z.string().min(1).max(1000),
});
export type ScanReceiptInput = z.infer<typeof ScanReceiptInput>;

export const RECEIPT_ERRORS = [
  "invalid_receipt",
  "store_not_in_mall",
  "wrong_category",
  "receipt_already_used",
  "receipt_outside_window",
  "mission_not_active",
] as const;
export type ReceiptError = (typeof RECEIPT_ERRORS)[number];

export const RECEIPT_ERROR_MESSAGES = {
  invalid_receipt: "Não conseguimos ler esse cupom. Escaneie o QR Code impresso no rodapé.",
  store_not_in_mall: "Esse cupom não é de uma loja do shopping.",
  wrong_category: "Essa compra não é da categoria da missão. Confira o desafio!",
  receipt_already_used: "Esse cupom já foi usado no Growlithe.",
  receipt_outside_window: "Esse cupom é de antes do início da missão.",
  mission_not_active: "Essa missão já terminou. Fique de olho na próxima!",
} as const satisfies Record<ReceiptError, string>;

/* ------------------------------------------------------------------ */
/* 7. Result + contratos de ação (front ⇄ back)                       */
/* ------------------------------------------------------------------ */

export type Result<TData, TError extends string> =
  | { ok: true; data: TData }
  | { ok: false; error: TError; message: string };

export const SCAN_ERRORS = [
  "invalid_qr",
  "expired_qr",
  "already_scanned_today",
  "mall_closed",
  "not_authenticated",
] as const;
export type ScanError = (typeof SCAN_ERRORS)[number];

/** Se alguém adicionar um erro novo e esquecer a mensagem, não compila. */
export const SCAN_ERROR_MESSAGES = {
  invalid_qr: "Esse QR Code não é do Growlithe.",
  expired_qr: "Esse QR Code expirou. Peça um novo na loja.",
  already_scanned_today: "Você já escaneou este ponto hoje. Volte amanhã!",
  mall_closed: "O shopping está fechado agora.",
  not_authenticated: "Entre na sua conta para ganhar pontos.",
} as const satisfies Record<ScanError, string>;

export type ScanSuccess = {
  pointsEarned: number;
  progress: MissionProgress[];
  /** Preenchido só quando o usuário subiu de nível neste scan. */
  tierUp: Tier | null;
};
export type ScanResult = Result<ScanSuccess, ScanError>;

/**
 * Fábrica de Server Actions com validação na borda.
 * - Input tipado no cliente (autocomplete) e validado no servidor (segurança).
 * - O handler só recebe dado já parseado.
 * - O erro "invalid_input" é somado à união de erros automaticamente.
 */
export const defineAction =
  <TSchema extends z.ZodType, TData, TError extends string>(
    schema: TSchema,
    handler: (input: z.output<TSchema>) => Promise<Result<TData, TError>>,
  ) =>
  async (input: z.input<TSchema>): Promise<Result<TData, TError | "invalid_input">> => {
    const parsed = schema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: "invalid_input",
        message: parsed.error.issues[0]?.message ?? "Entrada inválida",
      };
    }
    return handler(parsed.data);
  };

/* ------------------------------------------------------------------ */
/* 8. Exaustividade                                                   */
/* ------------------------------------------------------------------ */

export const assertNever = (value: never): never => {
  throw new Error(`Caso não tratado: ${JSON.stringify(value)}`);
};

export const progressLabel = (p: MissionProgress): string => {
  switch (p.status) {
    case "available":
      return "Disponível";
    case "in_progress":
      return `${p.current}/${p.target}`;
    case "completed":
      return `+${p.pointsAwarded} pts`;
    case "expired":
      return "Expirada";
    default:
      return assertNever(p);
  }
};

export const benefitLabel = (b: RewardBenefit): string => {
  switch (b.kind) {
    case "discount_percent":
      return `${b.percent}% de desconto`;
    case "discount_fixed":
      return `R$ ${(b.amountCents / 100).toFixed(2).replace(".", ",")} de desconto`;
    case "free_parking":
      return `${b.hours}h de estacionamento grátis`;
    case "gift":
      return b.description;
    default:
      return assertNever(b);
  }
};

/** Texto do card de missão — inclui a missão genérica de compra por categoria. */
export const requirementLabel = (r: MissionRequirement): string => {
  switch (r.kind) {
    case "qr_scan":
      return r.checkpointIds.length === 1
        ? "Escaneie o QR Code no local"
        : `Encontre ${r.checkpointIds.length} QR Codes${r.ordered ? " em ordem" : ""}`;
    case "visit_streak":
      return `Visite o shopping ${r.days} dias seguidos`;
    case "purchase":
      return `Compre a partir de R$ ${(r.minAmountCents / 100).toFixed(2).replace(".", ",")}`;
    case "purchase_category":
      return `Compre ${CATEGORY_LABELS[r.category]} em qualquer loja e escaneie o cupom`;
    case "event_checkin":
      return `Faça check-in no ${r.eventName}`;
    default:
      return assertNever(r);
  }
};

/* ------------------------------------------------------------------ */
/* 9. Landing page — lista de espera                                   */
/* ------------------------------------------------------------------ */

export const LEAD_PROFILES = ["visitante", "lojista", "shopping"] as const;
export const LeadProfile = z.enum(LEAD_PROFILES);
export type LeadProfile = z.infer<typeof LeadProfile>;

/** Parâmetros UTM: de onde veio a visita (QR do cartaz, Instagram, WhatsApp...). */
export const Utm = z.object({
  source: z.string().max(60).nullable(),
  medium: z.string().max(60).nullable(),
  campaign: z.string().max(60).nullable(),
});
export type Utm = z.infer<typeof Utm>;

export const LandingLead = z.object({
  id: z.uuid(),
  name: z.string().min(2, "Conta pra gente seu nome").max(80),
  email: z.email("Confira o e-mail"),
  profile: LeadProfile,
  /** Só preenchido quando o perfil é lojista ou shopping. */
  company: z.string().max(80).nullable(),
  /** Variante do teste A/B que o visitante viu. */
  variant: z.enum(["A", "B"]),
  utm: Utm,
  consentLgpd: z.literal(true, { message: "Precisamos do seu aceite para entrar em contato" }),
  createdAt: z.coerce.date(),
});
export type LandingLead = z.infer<typeof LandingLead>;

/** O que o formulário envia: o servidor gera `id`, `createdAt` e lê variante e UTM do cookie/URL. */
export const JoinWaitlistInput = LandingLead.pick({
  name: true,
  email: true,
  profile: true,
  company: true,
  consentLgpd: true,
});
export type JoinWaitlistInput = z.infer<typeof JoinWaitlistInput>;

/* ------------------------------------------------------------------ */
/* 10. Painel do shopping — admin e lojista (spec 003)                 */
/* ------------------------------------------------------------------ */

export const STAFF_ROLES = ["admin", "lojista"] as const;
export const StaffRole = z.enum(STAFF_ROLES);
export type StaffRole = z.infer<typeof StaffRole>;

/** Lojista sempre trabalha numa loja; admin não fica preso a nenhuma (D1, D6). */
export const StaffMember = z.discriminatedUnion("role", [
  z.object({ role: z.literal("admin"), userId: UserId }),
  z.object({ role: z.literal("lojista"), userId: UserId, storeId: StoreId }),
]);
export type StaffMember = z.infer<typeof StaffMember>;

/** Ponto físico com QR Code do Growlithe. `storeId: null` = ponto do shopping (entrada, palco). */
export const Checkpoint = z.object({
  id: CheckpointId,
  storeId: StoreId.nullable(),
  label: z.string().trim().min(2, "Dê um nome ao ponto, como \"Entrada Norte\"").max(60),
  dynamicQr: z.boolean(),
  active: z.boolean(),
});
export type Checkpoint = z.infer<typeof Checkpoint>;

/** O servidor gera `id`; todo checkpoint nasce ativo. */
export const CreateCheckpointInput = Checkpoint.pick({ storeId: true, label: true, dynamicQr: true });
export type CreateCheckpointInput = z.infer<typeof CreateCheckpointInput>;

export const REDEMPTION_VALIDATION_ERRORS = ["already_used", "expired", "other_store", "admin_only"] as const;
export type RedemptionValidationError = (typeof REDEMPTION_VALIDATION_ERRORS)[number];

export const REDEMPTION_VALIDATION_MESSAGES = {
  already_used: "Este cupom de resgate já foi usado. Peça ao visitante para conferir no app.",
  expired: "Este cupom de resgate venceu. O visitante pode gerar outro no app.",
  other_store: "Este cupom de resgate é de outra loja. Oriente o visitante a usá-lo lá.",
  admin_only: "Este benefício é validado pelo balcão do shopping. Oriente o visitante a ir até lá.",
} as const satisfies Record<RedemptionValidationError, string>;

/** Loja dona do benefício; `null` = benefício do shopping (só o admin valida). */
const benefitStoreId = (b: RewardBenefit): StoreId | null => {
  switch (b.kind) {
    case "discount_percent":
    case "discount_fixed":
    case "gift":
      return b.storeId;
    case "free_parking":
      return null;
    default:
      return assertNever(b);
  }
};

const refuse = (error: RedemptionValidationError): Result<null, RedemptionValidationError> => ({
  ok: false,
  error,
  message: REDEMPTION_VALIDATION_MESSAGES[error],
});

/**
 * Regra de quem pode validar qual cupom de resgate (critérios 15–18 da spec 003).
 * Pura: a função Postgres `validate_redemption` aplica a mesma regra de forma atômica.
 */
export const checkRedemptionValidation = (
  staff: StaffMember,
  redemption: Redemption,
  benefit: RewardBenefit,
  now: Date,
): Result<null, RedemptionValidationError> => {
  switch (redemption.status) {
    case "redeemed":
      return refuse("already_used");
    case "expired":
      return refuse("expired");
    case "reserved":
      if (redemption.expiresAt <= now) return refuse("expired");
      break;
    default:
      return assertNever(redemption);
  }

  switch (staff.role) {
    case "admin":
      return { ok: true, data: null };
    case "lojista": {
      const owner = benefitStoreId(benefit);
      if (owner === null) return refuse("admin_only");
      return owner === staff.storeId ? { ok: true, data: null } : refuse("other_store");
    }
    default:
      return assertNever(staff);
  }
};

const Count = z.number().int().nonnegative();

export const VariantFunnel = z.object({ visits: Count, leads: Count });
export type VariantFunnel = z.infer<typeof VariantFunnel>;

export const DashboardMetrics = z.object({
  checkinsToday: Count,
  uniqueVisitors7d: Count,
  /** Ordenado do mais para o menos escaneado. */
  scansByCheckpoint: z.array(z.object({ checkpointId: CheckpointId, label: z.string(), scans: Count })),
  missionsCompleted: Count,
  redemptionsValidated: Count,
  leads: z.object({ A: VariantFunnel, B: VariantFunnel }),
});
export type DashboardMetrics = z.infer<typeof DashboardMetrics>;

/** Conversão da landing (leads ÷ visitas); `null` quando ainda não há visitas. */
export const conversionRate = ({ visits, leads }: VariantFunnel): number | null =>
  visits === 0 ? null : leads / visits;
