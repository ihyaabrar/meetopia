"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { PublicShell } from "@/components/PublicShell";
import { Icon } from "@/components/Icon";
import { useT } from "@/i18n/client";

function Verified() {
  const t = useT();
  const ok = useSearchParams().get("ok") === "1";
  return (
    <div className="auth-wrap">
      <div className="card auth-card" style={{ textAlign: "center" }}>
        <div className="state-icon">
          <Icon name={ok ? "check" : "alert"} size={26} />
        </div>
        <h1>{ok ? t("verify.ok") : t("verify.fail")}</h1>
        <p className="sub">{ok ? t("verify.okBody") : t("verify.failBody")}</p>
        <Link className="btn" href="/app">
          {t("verify.open")}
        </Link>
      </div>
    </div>
  );
}

export default function VerifiedPage() {
  return (
    <PublicShell showAuth={false}>
      <Suspense>
        <Verified />
      </Suspense>
    </PublicShell>
  );
}
