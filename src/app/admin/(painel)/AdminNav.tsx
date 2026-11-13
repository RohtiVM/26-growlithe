"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { adminLogout } from "@/app/actions";

const LINKS = [
  { href: "/admin", label: "Visão geral" },
  { href: "/admin/missoes", label: "Missões" },
  { href: "/admin/checkpoints", label: "QR Codes" },
  { href: "/admin/validar", label: "Validar cupom" },
] as const;

export function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();
  return (
    <nav className="admin-nav" aria-label="Painel">
      <strong className="brand" style={{ marginRight: 8 }}>
        🔥 Growlithe · Painel
      </strong>
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          aria-current={(link.href === "/admin" ? pathname === "/admin" : pathname.startsWith(link.href)) ? "page" : undefined}
        >
          {link.label}
        </Link>
      ))}
      <button
        className="btn btn-ghost"
        style={{ marginLeft: "auto", padding: "0 14px" }}
        onClick={() => {
          void adminLogout().then(() => {
            router.replace("/admin/entrar");
          });
        }}
      >
        Sair
      </button>
    </nav>
  );
}
