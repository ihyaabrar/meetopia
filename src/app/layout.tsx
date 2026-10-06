import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import "./reference-ui.css";
import { I18nProvider } from "@/i18n/client";
import { DEFAULT_LOCALE, LOCALE_COOKIE, THEME_COOKIE, isLocale, isTheme, translate } from "@/i18n";
import { getSessionUser } from "@/server/auth";

export async function generateMetadata(): Promise<Metadata> {
  const c = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale = isLocale(c) ? c : DEFAULT_LOCALE;
  return { title: "Meetopia", description: translate(locale, "meta.description") };
}

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#09151c" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const jar = await cookies();
  const cookieLocale = jar.get(LOCALE_COOKIE)?.value;
  const cookieTheme = jar.get(THEME_COOKIE)?.value;
  const theme = isTheme(cookieTheme) ? cookieTheme : "dark";
  const user = await getSessionUser().catch(() => null);
  const locale = isLocale(user?.locale)
    ? user.locale
    : isLocale(cookieLocale)
      ? cookieLocale
      : DEFAULT_LOCALE;
  return (
    <html lang={locale} data-theme={theme} data-contrast={user?.highContrast ? "high" : undefined}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <I18nProvider initialLocale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
