import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StruCal",
  description: "Kalkulator Struktur Beton Bertulang",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
