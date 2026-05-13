import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import { QueryProvider } from "@/providers/query-provider";
import { AuthProvider } from "@/providers/auth-provider";
import { InstallPwaBanner } from "@/components/install-pwa-banner";
import "./globals.css";

// ─── Font ──────────────────────────────────────────────────────────────────────

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// ─── Metadata ─────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: "Tecozam Fleet",
  description: "App para conductores y operarios de Tecozam — escaneo de tickets, préstamos y alertas",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Tecozam Fleet",
  },
  icons: {
    apple: "/icon-192.png",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#FF8B01",
};

// ─── Root layout ──────────────────────────────────────────────────────────────

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark h-full">
      <body className={`${inter.variable} h-full bg-background text-foreground font-sans antialiased`}>
        <QueryProvider>
          <AuthProvider>
            {children}
            <InstallPwaBanner />
            <Toaster richColors position="top-center" />
          </AuthProvider>
        </QueryProvider>

        {/* Service Worker registration */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').catch(function() {});
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
