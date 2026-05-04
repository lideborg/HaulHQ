import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HAUL",
  description: "Personal rep catalog and shipping calculator.",
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
