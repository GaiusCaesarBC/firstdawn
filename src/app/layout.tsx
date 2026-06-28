import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "First Dawn",
  description: "A living civilization is coming soon.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
