"use client";

import { useActionState } from "react";
import { AlertTriangle, Flag } from "lucide-react";
import { endMissionAction, type EndMissionState } from "./actions";

const initial: EndMissionState = { status: "idle" };

/** UC4 / critério 12. Pede confirmação: encerrar não tem volta. */
export function EndMissionButton({ missionId, title }: { missionId: string; title: string }) {
  const [state, action, pending] = useActionState(endMissionAction, initial);

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(`Encerrar “${title}” agora? Os visitantes deixam de pontuar nela na hora.`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="missionId" value={missionId} />
      <button className="btn btn-secondary btn-sm" type="submit" disabled={pending}>
        <Flag size={16} aria-hidden /> {pending ? "Encerrando…" : "Encerrar"}
      </button>
      {state.status === "error" && (
        <p className="field-error" role="alert">
          <AlertTriangle size={18} aria-hidden style={{ flex: "none", marginTop: 2 }} />
          {state.message}
        </p>
      )}
    </form>
  );
}
