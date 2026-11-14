import type { Metadata } from "next";
import "./globals.css";
import { themeBootstrap } from "@/lib/theme";
export const metadata: Metadata = {
  title: "Mon Enfant · Le carnet de votre enfant",
  description:
    "Prototype du carnet de santé numérique de l’enfant — données fictives.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body>
        <a className="skip-link" href="#main-content">
          Aller au contenu principal
        </a>
        {children}
      </body>
    </html>
  );
}
