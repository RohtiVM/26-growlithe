"use client";

import { useEffect, useState } from "react";

const pad = (n: number) => String(n).padStart(2, "0");

const format = (ms: number): string => {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
};

/** Contagem regressiva até `endsAt` (ISO). Renderiza no servidor e atualiza a cada segundo. */
export function Countdown({ endsAt, initialNow }: { endsAt: string; initialNow: string }) {
  const end = new Date(endsAt).getTime();
  const [now, setNow] = useState(() => new Date(initialNow).getTime());

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => {
      clearInterval(id);
    };
  }, []);

  const left = end - now;
  return (
    <span className="timer" role="timer" aria-label="Tempo restante">
      {left > 0 ? format(left) : "Encerrada"}
    </span>
  );
}
