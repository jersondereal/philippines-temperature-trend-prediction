import { EnvVarWarning } from "@/components/env-var-warning";
import HeaderAuth from "@/components/header-auth";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Toaster } from "@/components/ui/toaster";
import { hasEnvVars } from "@/utils/supabase/check-env-vars";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const defaultUrl = process.env.VERCEL_URL
  ? `https://climatecastph.vercel.app/`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: "JC ClimateCast PH",
  description: "Climate Forecast for the Philippines",
  openGraph: {
    title: "JC ClimateCast PH",
    description:
      "Explore historical temperature data and climate change predictions for the Philippines from 1901 to 2100",
    url: defaultUrl,
    siteName: "ClimateCast PH",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/climatecastph.png",
        width: 1200,
        height: 630,
        alt: "Philippines Temperature Trend Analysis",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ClimateCast PH",
    description:
      "Philippines Temperature Trend Analysis and Climate Forecasting",
    images: ["/twitter-image.png"],
  },
};

const interFont = Inter({
  subsets: ["latin"],
  display: "swap",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={interFont.className} suppressHydrationWarning>
      <body className="bg-background text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <main className="min-h-screen flex flex-col items-center bg-background">
            <div className="flex-1 w-full flex flex-col gap-8 md:gap-16 items-center">
              <nav className="w-full flex justify-center border-b border-b-foreground/10 h-16">
                <div className="header-container w-full max-w-5xl p-3 px-5 text-sm">
                  <div className="row gap-5 items-center font-semibold">
                    <Link href={"/"} className="text-lg md:text-xl">
                      ClimateCast PH
                    </Link>
                  </div>
                  {!hasEnvVars ? <EnvVarWarning /> : <HeaderAuth />}
                </div>
              </nav>
              <div className="flex flex-col gap-8 max-w-5xl w-full px-4 md:px-8">
                {children}
              </div>

              <footer className="w-full mt-auto">
                <div className="footer-container border-t border-t-foreground/10 py-8 text-xs">
                  <p>
                    Crafted by{" "}
                    <a
                      href="https://github.com/jersoncaibog"
                      target="_blank"
                      className="font-bold hover:underline"
                      rel="noreferrer"
                    >
                      Jerson Caibog 🚀
                    </a>
                  </p>
                  <ThemeSwitcher />
                </div>
              </footer>
            </div>
          </main>
        </ThemeProvider>
        <Toaster />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
