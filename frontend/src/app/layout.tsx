import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/layout/app-shell";

export const metadata: Metadata = {
  title: "HALO - Gestionale Studio Dentistico",
  description: "Piattaforma gestionale modulare per studio dentistico",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full font-sans text-[var(--ui-text)]">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
