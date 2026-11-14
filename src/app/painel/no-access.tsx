import { signOut } from "./actions";

/** Critério 1: e-mail sem papel não vê nem carrega dado nenhum do painel. */
export function NoAccess() {
  return (
    <main className="container narrow">
      <h1>Você não tem acesso ao painel</h1>
      <p className="lead">
        Este e-mail não está cadastrado como equipe do shopping ou de uma loja. Se você trabalha aqui, peça acesso ao
        marketing do shopping.
      </p>
      <div className="actions">
        <a className="btn" href="/">
          Ir para o Growlithe
        </a>
        <form action={signOut}>
          <button className="btn btn-secondary" type="submit">
            Entrar com outro e-mail
          </button>
        </form>
      </div>
    </main>
  );
}
