"use client"

import { Suspense } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { LoginForm } from "@/components/workspace/auth-panel"
import { useAuth } from "@/components/workspace/auth-context"
import { useLanguage } from "@/components/workspace/language-context"
import { safeNextPath } from "@/lib/safe-next"

function LoginScreen() {
  const { user, loading, signOut } = useAuth()
  const { t } = useLanguage()
  const searchParams = useSearchParams()
  const nextPath = safeNextPath(searchParams.get("next"))
  const reason = searchParams.get("reason")
  const authError = searchParams.get("error")

  return (
    <main className="grid min-h-dvh place-items-center bg-background px-4 text-foreground">
      <div className="flex w-full max-w-md flex-col items-center gap-6 rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="text-center">
          <h1 className="font-display text-xl font-semibold">{t("sidebar.signIn")}</h1>
          {!loading && user ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {t("sidebar.signedInAs", { email: user.email ?? "" })}
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              {reason === "feature" ? t("sidebar.featureLogin") : t("sidebar.authSubtitle")}
            </p>
          )}
        </div>
        {authError === "callback" ? (
          <p className="w-full max-w-sm text-xs leading-snug text-destructive">
            {t("sidebar.authCallbackError")}
          </p>
        ) : null}
        {loading ? null : user ? (
          <div className="flex w-full max-w-sm flex-col gap-2">
            <Link
              href={nextPath}
              className="bg-brand-gradient grid h-10 place-items-center rounded-xl text-sm font-semibold text-white"
            >
              {t("sidebar.goToWorkspace")}
            </Link>
            <button
              type="button"
              onClick={() => void signOut()}
              className="h-10 rounded-xl border border-border bg-card text-sm font-semibold text-muted-foreground hover:text-foreground"
            >
              {t("sidebar.signOut")}
            </button>
          </div>
        ) : (
          <LoginForm nextPath={nextPath} />
        )}
      </div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="grid min-h-dvh place-items-center bg-background" />}>
      <LoginScreen />
    </Suspense>
  )
}
