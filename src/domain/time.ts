/**
 * Tempo no fuso do shopping (Tocantins, UTC-3, sem horário de verão).
 * "Dia" é sempre o dia local do shopping, não o do servidor (a Vercel roda em UTC).
 */
export const MALL_TIME_ZONE = "America/Araguaina";

const dayFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: MALL_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const hourFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: MALL_TIME_ZONE,
  hour: "2-digit",
  hourCycle: "h23",
});

/** Dia local no formato `AAAA-MM-DD`. */
export const localDay = (date: Date): string => dayFormat.format(date);

export const localHour = (date: Date): number => Number(hourFormat.format(date));

export const previousDay = (day: string): string => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

/**
 * Sequência de dias seguidos com visita. Se o visitante ainda não veio hoje,
 * a sequência de ontem continua valendo (ele ainda pode mantê-la).
 */
export const currentStreak = (visitDays: Iterable<string>, today: string): number => {
  const days = new Set(visitDays);
  let cursor = days.has(today) ? today : previousDay(today);
  let streak = 0;
  while (days.has(cursor)) {
    streak++;
    cursor = previousDay(cursor);
  }
  return streak;
};

export type MallHours = { open: number; close: number };

export const isMallOpen = (now: Date, hours: MallHours): boolean => {
  const hour = localHour(now);
  return hour >= hours.open && hour < hours.close;
};

const timeFormat = new Intl.DateTimeFormat("pt-BR", {
  timeZone: MALL_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
});

const dateTimeFormat = new Intl.DateTimeFormat("pt-BR", {
  timeZone: MALL_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export const formatTime = (date: Date): string => timeFormat.format(date);
export const formatDateTime = (date: Date): string => dateTimeFormat.format(date).replace(",", " às");
