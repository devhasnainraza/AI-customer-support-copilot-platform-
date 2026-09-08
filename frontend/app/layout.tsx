import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export const metadata: Metadata = {
  title: "AI Customer Support Copilot",
  description: "Enterprise AI-powered customer support platform",
  manifest: "/manifest.json",
  icons: { icon: "/icons/notification.png" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">
        <Providers>
          <ErrorBoundary pageName="Copilot Portal">{children}</ErrorBoundary>
        </Providers>
      </body>
    </html>
  );
}
