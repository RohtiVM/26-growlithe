"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const DISMISS_KEY = "gl_easter_noite_fechado";

/**
 * Easter egg da madrugada (spec 006, critérios 1 e 6): o mascote — uma chaminha
 * original de touca e pijama — dorme e manda o visitante dormir também.
 * Some ao tocar em "Até amanhã" e não volta nesta sessão.
 */
export function SleepingMascot({ forced = false }: { forced?: boolean }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = window.sessionStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      // Armazenamento bloqueado (aba anônima): mostra mesmo assim.
    }
    // Na demonstração (?easter=noite) aparece sempre, mesmo já fechado nesta aba.
    setOpen(forced || !dismissed);
  }, [forced]);

  const close = useCallback(() => {
    try {
      window.sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Sem armazenamento: fecha só nesta visualização.
    }
    setOpen(false);
  }, []);

  // Teclado: o foco vai para "Até amanhã" e o Esc fecha.
  useEffect(() => {
    if (!open) return;
    button.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); };
  }, [open, close]);

  if (!open) return null;

  return (
    <div className="egg-night" role="dialog" aria-modal="true" aria-labelledby="egg-night-title">
      <div className="egg-night-card">
        <svg className="egg-mascot" viewBox="0 0 160 150" aria-hidden="true">
          {/* Lua e estrelas */}
          <circle cx="132" cy="24" r="12" className="egg-moon" />
          <circle cx="138" cy="20" r="10" className="egg-moon-cut" />
          <circle cx="22" cy="20" r="2" className="egg-star" />
          <circle cx="40" cy="38" r="1.5" className="egg-star" />
          <circle cx="116" cy="52" r="1.5" className="egg-star" />
          {/* Travesseiro */}
          <ellipse cx="80" cy="132" rx="62" ry="12" className="egg-pillow" />
          {/* Chaminha */}
          <path
            className="egg-flame"
            d="M80 128c-26 0-42-15-42-36 0-17 10-27 18-37 3 9 9 13 14 14-3-14 2-29 18-43-1 15 7 23 15 32 8 9 19 19 19 35 0 20-16 35-42 35z"
          />
          <path
            className="egg-flame-core"
            d="M80 124c-13 0-21-8-21-19 0-9 6-15 11-20 2 6 6 8 9 8-1-8 2-15 9-21 0 9 4 13 8 18 4 5 6 9 6 15 0 11-9 19-22 19z"
          />
          {/* Touca de dormir */}
          <path className="egg-cap" d="M52 66c6-22 34-34 58-22l14 22-74 8z" />
          <path className="egg-cap-band" d="M48 68c18-6 50-9 78-3l-2 9c-26-5-56-3-75 3z" />
          <circle cx="128" cy="70" r="7" className="egg-cap-ball" />
          {/* Rosto dormindo */}
          <path className="egg-eye" d="M66 100q6 5 12 0" />
          <path className="egg-eye" d="M86 100q6 5 12 0" />
          <path className="egg-mouth" d="M78 112q4 3 8 0" />
          <circle cx="62" cy="108" r="4" className="egg-blush" />
          <circle cx="102" cy="108" r="4" className="egg-blush" />
          {/* Gola listrada do pijama */}
          <path className="egg-pajama" d="M50 122c18 8 42 8 60 0l4 8c-22 9-46 9-68 0z" />
        </svg>
        <p className="egg-zzz" aria-hidden="true">
          <span>z</span>
          <span>z</span>
          <span>Z</span>
        </p>
        <h2 id="egg-night-title">Psiu… o shopping está dormindo</h2>
        <p>O shopping está descansando para te receber amanhã… Vai dormir também!</p>
        <button ref={button} type="button" className="btn btn-block" onClick={close}>
          Até amanhã
        </button>
      </div>
    </div>
  );
}
