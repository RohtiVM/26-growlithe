/**
 * Easter egg de sexta-feira 13 (spec 006): o app reage ao horário e ao clima de
 * Palmas. Funções puras; o servidor injeta a hora e o clima.
 */
import { z } from "zod";

export const EasterEgg = z.enum(["noite", "chuva"]);
export type EasterEgg = z.infer<typeof EasterEgg>;

export type Weather = { precipitation: number; weatherCode: number };

/** Hora (0–23) em Palmas (`America/Araguaina`, sem horário de verão). */
export const hourInPalmas = (now: Date): number =>
  Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: "America/Araguaina" }).format(now));

/** Códigos WMO de chuva forte, pancada forte e tempestade (D5). */
const HEAVY_RAIN_CODES = new Set([63, 65, 81, 82, 95, 96, 99]);
const HEAVY_RAIN_MM_PER_HOUR = 2.5;

export const isHeavyRain = (w: Weather): boolean =>
  w.precipitation >= HEAVY_RAIN_MM_PER_HOUR || HEAVY_RAIN_CODES.has(w.weatherCode);

/** `?easter=noite|chuva` força o efeito na demonstração (D7). Qualquer outro valor é ignorado. */
export const parseEasterOverride = (raw: string | string[] | undefined): EasterEgg | null => {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const parsed = EasterEgg.safeParse(value);
  return parsed.success ? parsed.data : null;
};

/** Qual efeito mostrar agora. A madrugada vence a chuva (D8); sem clima, não há chuva. */
export const resolveEasterEgg = ({
  now,
  weather,
  override,
}: {
  now: Date;
  weather: Weather | null;
  override: EasterEgg | null;
}): EasterEgg | null => {
  if (override !== null) return override;
  if (hourInPalmas(now) < 6) return "noite";
  if (weather !== null && isHeavyRain(weather)) return "chuva";
  return null;
};
