"use client"

import { useState, type FormEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/workspace/auth-context"
import { useLanguage } from "@/components/workspace/language-context"

export default function UpdatePasswordPage() {
  const router = useRouter()
  const { configured, loading, user, updatePassword } = useAuth()
  const { t } = useLanguage()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const password = String(new FormData(event.currentTarget).get("password") ?? "")
    setBusy(true)
    setError(null)
    const message = await updatePassword(password)
    setBusy(false)
    if (message) {
      setError(message)
      return
    }
    router.replace("/workspace")
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-background px-4 text-foreground">
      <div className="flex w-full max-w-md flex-col items-center gap-6 rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="text-center">
          <h1 className="font-display text-xl font-semibold">{t("sidebar.updatePasswordTitle")}</h1>
        </div>
        {!configured ? (
          <p className="text-sm text-muted-foreground">{t("sidebar.authUnavailable")}</p>
        ) : loading ? null : !user ? (
          <div className="flex w-full max-w-sm flex-col gap-3">
            <p className="text-sm text-muted-foreground">{t("sidebar.invalidRecoveryLink")}</p>
            <Link
              href="/forgot-password"
              className="bg-brand-gradient grid h-10 place-items-center rounded-xl text-sm font-semibold text-white"
            >
              {t("sidebar.sendResetLink")}
            </Link>
          </div>
        ) : (
          <form onSubmit={(event) => void onSubmit(event)} className="flex w-full max-w-sm flex-col gap-3">
            <input
              type="password"
              name="password"
              autoComplete="new-password"
              required
              minLength={6}
              placeholder={t("sidebar.newPassword")}
              className="h-10 rounded-xl border border-border bg-background px-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary/50"
            />
            {error ? <p className="text-xs leading-snug text-destructive">{error}</p> : null}
            <button
              type="submit"
              disabled={busy}
              className="bg-brand-gradient h-10 rounded-xl text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("sidebar.savePassword")}
            </button>
          </form>
        )}
      </div>
    </main>
  )
}
