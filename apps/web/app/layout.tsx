import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Paperloom | Research Paper Discovery",
  description: "Find and organize research that moves your work forward.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
