import type { Metadata } from "next";
import "./globals.css";
import "./site-design.css";
import { Suspense } from "react";
import { ParentMobileNav } from "@/components/parent-mobile-nav";
export const metadata: Metadata = {
  title: "Mon Enfant · Le carnet de votre enfant",
  description:
    "Prototype du carnet de santé numérique de l’enfant — données fictives.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" data-theme="light">
      <body>
        <a className="skip-link" href="#main-content">
          Aller au contenu principal
        </a>
        {children}
        <Suspense fallback={null}>
          <ParentMobileNav />
        </Suspense>
      </body>
    </html>
  );
}
