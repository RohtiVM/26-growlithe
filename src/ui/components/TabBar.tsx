"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/app", label: "Início", icon: "🏠" },
  { href: "/app/missoes", label: "Missões", icon: "🎯" },
  { href: "/app/scanner", label: "Escanear", icon: "📷", primary: true },
  { href: "/app/premios", label: "Prêmios", icon: "🎁" },
  { href: "/app/perfil", label: "Perfil", icon: "👤" },
] as const;

export function TabBar() {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/app" ? pathname === "/app" : pathname.startsWith(href));

  return (
    <nav className="tabbar" aria-label="Navegação principal">
      <ul>
        {TABS.map((tab) => (
          <li key={tab.href}>
            <Link href={tab.href} aria-current={isActive(tab.href) ? "page" : undefined}>
              {"primary" in tab ? (
                <span className="scan-btn" style={{ display: "grid", placeItems: "center" }} aria-hidden="true">
                  {tab.icon}
                </span>
              ) : (
                <span className="icon" aria-hidden="true">
                  {tab.icon}
                </span>
              )}
              <span>{tab.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
