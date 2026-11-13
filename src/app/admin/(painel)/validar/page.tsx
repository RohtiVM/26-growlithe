import { ValidateForm } from "./ValidateForm";

export default function ValidatePage() {
  return (
    <section style={{ maxWidth: 420 }}>
      <h1>Validar cupom de resgate</h1>
      <p className="muted">Digite os 6 números que o cliente mostra no celular.</p>
      <ValidateForm />
    </section>
  );
}
