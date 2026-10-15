"use client"

import { useState, type FormEvent } from "react"
import Link from "next/link"
import { useAuth } from "@/components/workspace/auth-context"
import { useLanguage } from "@/components/workspace/language-context"

export default function ForgotPasswordPage() {
  const { configured, requestPasswordReset } = useAuth()
  const { t } = useLanguage()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim()
    setBusy(true)
    setError(null)
    const message = await requestPasswordReset(email)
    setBusy(false)
    if (message) {
      setError(message)
      return
    }
    setSent(true)
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-background px-4 text-foreground">
      <div className="flex w-full max-w-md flex-col items-center gap-6 rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="text-center">
          <h1 className="font-display text-xl font-semibold">{t("sidebar.resetTitle")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("sidebar.resetHelper")}</p>
        </div>
        {!configured ? (
          <p className="text-sm text-muted-foreground">{t("sidebar.authUnavailable")}</p>
        ) : (
          <form onSubmit={(event) => void onSubmit(event)} className="flex w-full max-w-sm flex-col gap-3">
            <input
              type="email"
              name="email"
              autoComplete="email"
              required
              placeholder={t("sidebar.email")}
              className="h-10 rounded-xl border border-border bg-background px-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary/50"
            />
            {error ? <p className="text-xs leading-snug text-destructive">{error}</p> : null}
            {sent ? <p className="text-xs leading-snug text-muted-foreground">{t("sidebar.checkEmail")}</p> : null}
            <button
              type="submit"
              disabled={busy}
              className="bg-brand-gradient h-10 rounded-xl text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("sidebar.sendResetLink")}
            </button>
            <Link
              href="/login"
              className="grid h-10 place-items-center rounded-xl border border-border bg-card text-sm font-semibold text-muted-foreground hover:text-foreground"
            >
              {t("sidebar.signIn")}
            </Link>
          </form>
        )}
      </div>
    </main>
  )
}
