import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Mon Enfant · Espace professionnel",
  description:
    "Prototype du carnet de santé numérique de l’enfant — données fictives.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body>
        <a className="skip-link" href="#main-content">
          Aller au contenu principal
        </a>
        {children}
      </body>
    </html>
  );
}
