"use client";

import { useEffect, useState } from "react";

/** Segundos até a próxima ocorrência de `hour`:00 no horário local. */
const secondsUntil = (hour: number, now: Date): number => {
  const target = new Date(now);
  target.setHours(hour, 0, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  return Math.floor((target.getTime() - now.getTime()) / 1000);
};

const pad = (n: number): string => String(n).padStart(2, "0");

/**
 * Contagem regressiva da Missão Relâmpago de exemplo. Atualiza só o texto, sem
 * animação (muda a cada segundo). Renderiza um marcador estável no servidor para
 * não haver diferença de hidratação.
 */
export function Countdown({ untilHour }: { untilHour: number }) {
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => { setLeft(secondsUntil(untilHour, new Date())); };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => { window.clearInterval(id); };
  }, [untilHour]);

  const text =
    left === null
      ? "--:--:--"
      : `${pad(Math.floor(left / 3600))}:${pad(Math.floor((left % 3600) / 60))}:${pad(left % 60)}`;

  return (
    <time className="countdown" aria-live="off" suppressHydrationWarning>
      {text}
    </time>
  );
}
