"use client";

import Link from "next/link";
import { Logo } from "./Logo";
import { LanguageSwitch } from "./LanguageSwitch";
import { useT } from "@/i18n/client";

export function PublicShell({
  children,
  showAuth = true,
}: {
  children: React.ReactNode;
  showAuth?: boolean;
}) {
  const t = useT();
  return (
    <div className="public">
      <header className="public-header">
        <Link href="/" aria-label="Meetopia" style={{ textDecoration: "none" }}>
          <Logo size={30} />
        </Link>
        <span className="spacer" />
        <LanguageSwitch />
        {showAuth && (
          <>
            <Link className="btn ghost" href="/login">
              {t("auth.login")}
            </Link>
            <Link className="btn" href="/register">
              {t("auth.register")}
            </Link>
          </>
        )}
      </header>
      {children}
      <footer className="public-footer">
        <Logo size={18} /> · {t("landing.footer")}
      </footer>
    </div>
  );
}
