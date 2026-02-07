import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mercosur News",
  description: "Regional intelligence dashboard",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon-v2.png", // Forced cache-bust
    apple: "/icon-v2.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#05070f" />
      </head>
      <body className="bg-[#05070f] text-[#EAF0FF] antialiased">
        {children}
      </body>
    </html>
  );
}