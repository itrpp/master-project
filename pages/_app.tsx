import type { AppProps } from "next/app";
import { useEffect } from "react";
import { useRouter } from "next/router";
import { HeroUIProvider } from "@heroui/system";
import { ThemeProvider as NextThemesProvider } from "next-themes";

import { fontSans, fontMono, fontThai } from "@/config/fonts";
import { appBuildId } from "@/lib/version";
import "@/styles/globals.css";

const CLIENT_BUILD_ID = appBuildId;
const BUILD_ID_POLL_MS = 60_000;

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();

  // Auto-reload เมื่อมี deploy build ใหม่บน server
  useEffect(() => {
    if (!CLIENT_BUILD_ID || typeof window === "undefined") return;

    let cancelled = false;
    let reloading = false;

    const checkBuildId = async () => {
      if (cancelled || reloading) return;
      try {
        const res = await fetch("/api/version", {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (!res.ok || cancelled) return;
        const body = (await res.json()) as {
          success?: boolean;
          data?: { buildId?: string };
        };
        const serverBuildId = String(body?.data?.buildId ?? "").trim();
        if (!serverBuildId || serverBuildId === CLIENT_BUILD_ID) return;
        reloading = true;
        window.location.reload();
      } catch {
        // ignore
      }
    };

    void checkBuildId();
    const timer = window.setInterval(() => {
      void checkBuildId();
    }, BUILD_ID_POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <HeroUIProvider navigate={router.push}>
      <NextThemesProvider
        attribute="class"
        defaultTheme="light"
        enableSystem={false}
        forcedTheme="light"
      >
        <Component {...pageProps} />
      </NextThemesProvider>
    </HeroUIProvider>
  );
}

export const fonts = {
  sans: fontSans.style.fontFamily,
  mono: fontMono.style.fontFamily,
  thai: fontThai.style.fontFamily,
};
