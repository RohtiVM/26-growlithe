"use client";

import Link from "next/link";
import type { scanQr } from "@/app/actions";
import type { ProgressOf } from "@/domain/schemas";
import { TIER_LABELS, formatPoints } from "@/ui/labels";
import { ProgressBar } from "./ProgressBar";

export type ScanActionResult = Awaited<ReturnType<typeof scanQr>>;

const ERROR_ICONS = {
  invalid_qr: "🤔",
  expired_qr: "⌛",
  already_scanned_today: "⏰",
  mall_closed: "🌙",
  not_authenticated: "🔑",
  invalid_input: "🤔",
} as const satisfies Record<Extract<ScanActionResult, { ok: false }>["error"], string>;

export function ScanResultView({ result, onAgain }: { result: ScanActionResult; onAgain?: () => void }) {
  if (!result.ok) {
    return (
      <section className="result rise" role="alert">
        <div className="emoji" aria-hidden="true">
          {ERROR_ICONS[result.error]}
        </div>
        <p style={{ fontSize: "1.25rem", fontWeight: 700, margin: "12px 0 24px" }}>{result.message}</p>
        <div className="stack">
          {result.error === "not_authenticated" ? (
            <Link className="btn btn-block" href="/app/entrar">
              Entrar e ganhar pontos
            </Link>
          ) : (
            onAgain !== undefined && (
              <button className="btn btn-block" onClick={onAgain}>
                Escanear outro QR
              </button>
            )
          )}
          <Link className="btn btn-ghost btn-block" href="/app/missoes">
            Ver outras missões
          </Link>
        </div>
      </section>
    );
  }

  const { pointsEarned, checkpointLabel, completedMissions, progress, tierUp, nextHint } = result.data;
  const inProgress = progress.filter((p): p is ProgressOf<"in_progress"> => p.status === "in_progress");

  return (
    <section className="result" aria-live="polite">
      <p className="muted" style={{ margin: 0 }}>
        📍 {checkpointLabel}
      </p>
      <p className="big pop">+{formatPoints(pointsEarned)}</p>
      <p style={{ fontWeight: 700, marginTop: 0 }}>pontos ganhos!</p>

      <div className="stack" style={{ textAlign: "left", margin: "20px 0" }}>
        {completedMissions.map((m) => (
          <div key={m.title} className="card row between rise">
            <span>
              ✅ <strong>{m.title}</strong>
            </span>
            <span className="pts">+{formatPoints(m.points)}</span>
          </div>
        ))}
        {inProgress.map((p) => (
          <div key={p.missionId} className="card stack rise">
            <div className="row between">
              <span>🗺️ Missão em andamento</span>
              <strong>
                {p.current}/{p.target}
              </strong>
            </div>
            <ProgressBar value={p.current} max={p.target} label="Progresso da missão" />
          </div>
        ))}
        {tierUp !== null && (
          <div className="flash-card pop" style={{ textAlign: "center" }}>
            <strong>{TIER_LABELS[tierUp]}: você subiu de nível!</strong>
          </div>
        )}
        {nextHint !== null && (
          <div className="card rise">
            <p style={{ fontWeight: 700, marginBottom: 4 }}>🔎 Próxima pista</p>
            <p className="muted">{nextHint}</p>
          </div>
        )}
      </div>

      <div className="stack">
        {onAgain !== undefined && (
          <button className="btn btn-block" onClick={onAgain}>
            Escanear outro QR
          </button>
        )}
        <Link className="btn btn-ghost btn-block" href="/app">
          Voltar ao início
        </Link>
      </div>
    </section>
  );
}
