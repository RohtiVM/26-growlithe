import { CloudRain, Coffee, Umbrella } from "lucide-react";

/** Gotas escorrendo (spec 006, critério 3). Só decoração: não captura toque nem leitor de tela. */
export function RainLayer() {
  // Posições e ritmos fixos e não uniformes: parece chuva, não grade.
  const drops = [4, 11, 19, 27, 33, 41, 48, 56, 63, 70, 77, 84, 91, 97];
  return (
    <div className="egg-rain" aria-hidden="true">
      {drops.map((left, i) => (
        <span
          key={left}
          className="egg-drop"
          style={{ left: `${left}%`, animationDelay: `${(i * 0.37) % 2.4}s`, animationDuration: `${1.6 + ((i * 0.53) % 1.4)}s` }}
        />
      ))}
    </div>
  );
}

type RainStore = { name: string; kind: "guarda-chuva" | "bebida" };

/** Destaque de lojas para dia de chuva: capas/guarda-chuvas (vestuário) e bebidas quentes (alimentação). */
export function RainCard({ stores }: { stores: readonly RainStore[] }) {
  return (
    <section className="card egg-rain-card" aria-labelledby="egg-rain-title">
      <div className="egg-rain-head">
        <span className="icon-tile"><CloudRain size={22} aria-hidden /></span>
        <div>
          <h2 id="egg-rain-title">Chovendo em Palmas</h2>
          <p className="muted">Fique seco e quentinho aqui dentro. Separamos o que combina com o dia:</p>
        </div>
      </div>
      {stores.length === 0 ? (
        <ul className="egg-rain-list">
          <li><Umbrella size={18} aria-hidden /><span>Guarda-chuvas e capas nas lojas de moda</span></li>
          <li><Coffee size={18} aria-hidden /><span>Cafés e chocolates quentes na praça de alimentação</span></li>
        </ul>
      ) : (
        <ul className="egg-rain-list">
          {stores.map((s) => (
            <li key={s.name}>
              {s.kind === "guarda-chuva" ? <Umbrella size={18} aria-hidden /> : <Coffee size={18} aria-hidden />}
              <span>
                <strong>{s.name}</strong>{" "}
                <span className="muted">· {s.kind === "guarda-chuva" ? "guarda-chuvas e capas" : "bebidas quentes"}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
