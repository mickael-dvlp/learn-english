import type { Metadata, Viewport } from "next";
import { PersistStorage } from "@/components/persist-storage";
import "./globals.css";

export const metadata: Metadata = {
  title: "Anglais",
  description: "Écouter et étudier l'anglais, même avant de dormir.",
  // Personal app: kept out of search engines.
  robots: { index: false, follow: false },
  icons: {
    icon: [
      { url: "/image/logo-mouton.svg", type: "image/svg+xml" },
      { url: "/image/favicon.ico", sizes: "16x16" },
    ],
    apple: { url: "/image/logo-192.png", sizes: "192x192" },
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f1e8" },
    { media: "(prefers-color-scheme: dark)", color: "#1c1713" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">
        <PersistStorage />
        {children}
      </body>
    </html>
  );
}
