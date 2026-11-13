import { z } from "zod";

/** Teste A/B de manchete da landing page (docs/07-pratica-sorteada-landing-page.md). */
export const AB_COOKIE = "gl_ab_headline";

export const Variant = z.enum(["A", "B"]);
export type Variant = z.infer<typeof Variant>;

export const HEADLINES = {
  A: "Seu passeio no shopping agora vale prêmios.",
  B: "Ganhe estacionamento grátis só por passear.",
} as const satisfies Record<Variant, string>;

/** Sorteio 50/50. `random` é injetável para os testes. */
export const pickVariant = (random: () => number = Math.random): Variant =>
  random() < 0.5 ? "A" : "B";

/** Lê a variante do cookie; valor ausente ou adulterado vira `null`. */
export const parseVariant = (raw: string | undefined): Variant | null => {
  const parsed = Variant.safeParse(raw);
  return parsed.success ? parsed.data : null;
};
