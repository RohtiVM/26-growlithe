import { AdminLoginForm } from "./AdminLoginForm";

export default function AdminLoginPage() {
  return (
    <main className="app" style={{ paddingBottom: 32 }}>
      <p className="brand">🔥 Growlithe · Painel</p>
      <h1 style={{ fontSize: "1.5rem", margin: "32px 0 8px" }}>Painel do shopping</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        Crie missões, imprima QR Codes e valide cupons de resgate.
      </p>
      <AdminLoginForm />
    </main>
  );
}
