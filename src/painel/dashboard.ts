/** Dashboard do admin (spec 003, T9): borda do banco → tela. */
import { conversionRate, DashboardMetrics, type VariantFunnel } from "@/domain/schemas";

export type DashboardView = { kind: "ok"; metrics: DashboardMetrics; empty: boolean } | { kind: "error" };

/** Resposta de `dashboard_metrics()`. `empty` = nenhum scan ainda (critério 7). */
export const dashboardFromRow = (raw: unknown): DashboardView => {
  const parsed = DashboardMetrics.safeParse(raw);
  if (!parsed.success) return { kind: "error" };
  return { kind: "ok", metrics: parsed.data, empty: parsed.data.scansByCheckpoint.length === 0 };
};

export const formatConversion = (funnel: VariantFunnel): string => {
  const rate = conversionRate(funnel);
  return rate === null ? "—" : `${Math.round(rate * 100)}%`;
};
