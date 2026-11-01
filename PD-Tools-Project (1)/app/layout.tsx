import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PD Tools — Ferramentas gratuitas",
  description: "Ferramentas gratuitas para facilitar seu dia a dia. Uma iniciativa Platform Destroyer.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}