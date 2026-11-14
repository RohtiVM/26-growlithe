/**
 * Modo avaliador (spec 008): login anônimo vira admin até o fim do HackaRun.
 * O banco aplica a mesma regra em `private.staff_role()`; aqui o app esconde o
 * botão e trata o papel vencido como "sem papel".
 */

/** 15/11/2026 23h59 em Palmas (UTC−3). Igual ao prazo da migration `modo_avaliador`. */
export const EVALUATOR_UNTIL = new Date("2026-11-16T02:59:59Z");

export const isEvaluatorWindowOpen = (now: Date): boolean => now < EVALUATOR_UNTIL;

/** `null` = conta sem prazo (admin ou lojista de verdade). Valor inválido conta como vencido. */
export const evaluatorRoleExpired = (until: string | null, now: Date): boolean => {
  if (until === null) return false;
  const t = Date.parse(until);
  return Number.isNaN(t) || t <= now.getTime();
};
