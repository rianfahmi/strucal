import type { Metadata } from "next";
import { AppShell } from "../components/app-shell";
import { ProjectProvider } from "../components/project-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "StruCal", template: "%s | StruCal" },
  description: "Kalkulator Struktur Beton Bertulang",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body><ProjectProvider><AppShell>{children}</AppShell></ProjectProvider></body>
    </html>
  );
}
