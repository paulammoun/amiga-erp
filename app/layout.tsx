import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Workshop — Service Desk",
  description: "Items, customers and invoicing in one simple app.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
