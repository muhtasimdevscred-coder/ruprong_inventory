"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const TABS = [
  { href: "/inventory", label: "Inventory" },
  { href: "/invoice", label: "Create Invoice" },
  { href: "/history", label: "Invoice History" },
  { href: "/reports", label: "Reports" },
  { href: "/settings", label: "Settings" },
];

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <nav className="nav">
      <img src="/logo.jpg" alt="RupRong" style={{ height: 32, marginRight: 8, borderRadius: 4 }} />
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} className={pathname.startsWith(t.href) ? "active" : ""}>
          {t.label}
        </Link>
      ))}
      <span className="spacer" />
      <span className="logout" onClick={logout}>Log Out</span>
    </nav>
  );
}
