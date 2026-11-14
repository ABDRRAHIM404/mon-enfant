"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Home, Heart, CalendarDays, BookOpen } from "lucide-react";

export function ParentMobileNav() {
  const pathname = usePathname();
  const params = useSearchParams();
  if (!(
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname.startsWith("/parent")
  ))
    return null;
  const view = params.get("view");
  const items = [
    { href: "/", label: "Accueil", Icon: Home, active: pathname === "/" },
    {
      href: "/parent",
      label: "Enfants",
      Icon: Heart,
      active: pathname.startsWith("/parent") && !view,
    },
    {
      href: "/parent?view=appointments",
      label: "Rendez-vous",
      Icon: CalendarDays,
      active: pathname === "/parent" && view === "appointments",
    },
    {
      href: "/parent?view=documents",
      label: "Documents",
      Icon: BookOpen,
      active: pathname === "/parent" && view === "documents",
    },
  ];
  return (
    <nav className="parent-mobile-nav" aria-label="Accès rapides parent">
      {items.map(({ href, label, Icon, active }) => (
        <Link key={href} href={href} aria-current={active ? "page" : undefined}>
          <Icon size={21} aria-hidden="true" />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
