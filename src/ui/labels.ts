import type { MissionKind, StoreCategory, Tier } from "@/domain/schemas";

export const TIER_LABELS = {
  bronze: "🥉 Bronze",
  prata: "🥈 Prata",
  ouro: "🥇 Ouro",
  diamante: "💎 Diamante",
} as const satisfies Record<Tier, string>;

export const TIER_NAMES = {
  bronze: "Bronze",
  prata: "Prata",
  ouro: "Ouro",
  diamante: "Diamante",
} as const satisfies Record<Tier, string>;

export const MISSION_ICONS = {
  qr_scan: "🗺️",
  visit_streak: "🔥",
  purchase: "🛍️",
  purchase_category: "⚡",
  event_checkin: "🎤",
} as const satisfies Record<MissionKind, string>;

export const MISSION_KIND_LABELS = {
  qr_scan: "QR Code / caça ao tesouro",
  visit_streak: "Sequência de visitas",
  purchase: "Compra em loja",
  purchase_category: "Compra por categoria (cupom fiscal)",
  event_checkin: "Check-in em evento",
} as const satisfies Record<MissionKind, string>;

export const CATEGORY_NAMES = {
  vestuario: "Vestuário",
  calcados: "Calçados",
  alimentacao: "Alimentação",
  beleza: "Beleza",
  eletronicos: "Eletrônicos",
  esportes: "Esportes",
  livraria: "Livraria",
  casa: "Casa",
  lazer: "Lazer",
  servicos: "Serviços",
} as const satisfies Record<StoreCategory, string>;

export const formatPoints = (n: number): string => n.toLocaleString("pt-BR");

export const initials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
