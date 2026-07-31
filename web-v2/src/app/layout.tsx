import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://haulhq.shop"),
  title: "HaulHQ",
  description: "Curated rep-fashion sourcing for friends.",
  openGraph: {
    title: "HaulHQ",
    description: "Invite-only rep-fashion sourcing.",
    url: "https://haulhq.shop",
    siteName: "HaulHQ",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "HaulHQ",
    description: "Invite-only rep-fashion sourcing.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
