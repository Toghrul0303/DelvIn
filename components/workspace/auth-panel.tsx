"use client"

import { useState, type FormEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { useAuth } from "./auth-context"
import { useLanguage } from "./language-context"

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.05l3.01-2.33z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  )
}

export function LoginForm({ nextPath }: { nextPath: string }) {
  const router = useRouter()
  const { configured, signIn, signUp, signInWithGoogle } = useAuth()
  const { t } = useLanguage()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const onGoogle = async () => {
    setBusy(true)
    setError(null)
    setInfo(null)
    const message = await signInWithGoogle(nextPath)
    setBusy(false)
    if (message) setError(message)
  }

  const run = async (mode: "in" | "up", email: string, password: string) => {
    setBusy(true)
    setError(null)
    setInfo(null)
    if (!email || !password) {
      setBusy(false)
      setError(t("sidebar.enterCredentials"))
      return
    }
    const message = mode === "in" ? await signIn(email, password) : await signUp(email, password)
    setBusy(false)
    if (message) {
      setError(message)
      return
    }
    if (mode === "up") setInfo(t("sidebar.confirmEmail"))
    else router.replace(nextPath)
  }

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const submitter = (event.nativeEvent as SubmitEvent).submitter
    const data = new FormData(event.currentTarget, submitter)
    const email = String(data.get("email") ?? "").trim()
    const password = String(data.get("password") ?? "")
    const mode = data.get("mode") === "up" ? "up" : "in"
    void run(mode, email, password)
  }

  if (!configured) {
    return <p className="text-sm text-muted-foreground">{t("sidebar.authUnavailable")}</p>
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full max-w-sm flex-col gap-3">
      <button
        type="button"
        disabled={busy}
        onClick={() => void onGoogle()}
        className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-border bg-card text-sm font-semibold text-foreground hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
      >
        <GoogleMark />
        {t("sidebar.continueWithGoogle")}
      </button>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        {t("sidebar.or")}
        <span className="h-px flex-1 bg-border" />
      </div>
      <input
        type="email"
        name="email"
        autoComplete="email"
        required
        placeholder={t("sidebar.email")}
        className="h-10 rounded-xl border border-border bg-background px-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary/50"
      />
      <input
        type="password"
        name="password"
        autoComplete="current-password"
        required
        minLength={6}
        placeholder={t("sidebar.password")}
        className="h-10 rounded-xl border border-border bg-background px-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary/50"
      />
      <div className="flex justify-end">
        <Link
          href="/forgot-password"
          className="text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          {t("sidebar.forgotPassword")}
        </Link>
      </div>
      {error ? <p className="text-xs leading-snug text-destructive">{error}</p> : null}
      {info ? <p className="text-xs leading-snug text-muted-foreground">{info}</p> : null}
      <div className="flex gap-2">
        <button
          type="submit"
          name="mode"
          value="in"
          disabled={busy}
          className={cn(
            "bg-brand-gradient h-10 flex-1 rounded-xl text-sm font-semibold text-white",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          {t("sidebar.signIn")}
        </button>
        <button
          type="submit"
          name="mode"
          value="up"
          disabled={busy}
          className="h-10 flex-1 rounded-xl border border-border bg-card text-sm font-semibold text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t("sidebar.signUp")}
        </button>
      </div>
    </form>
  )
}
