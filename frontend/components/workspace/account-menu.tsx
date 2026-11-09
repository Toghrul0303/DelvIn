"use client"

import { useEffect, useId, useRef, useState } from "react"
import Link from "next/link"
import { Monitor, Moon, Sun } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { useAuth } from "./auth-context"
import { useLanguage } from "./language-context"
import { useMode, type ThemePreference } from "./mode-context"

type PlanName = "free" | "pro" | "premium"

type SubscriptionRow = {
  plan: string
  current_period_end: string | null
  text_used: number | null
  text_period: string | null
  text_queries_daily: number | null
  vision_used: number | null
  vision_period: string | null
  vision_queries_monthly: number | null
}

type UsageView = {
  plan: PlanName
  paid: boolean
  textUsed: number
  textCap: number | null
  visionUsed: number
  visionCap: number
}

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; usage: UsageView }

function utcDay(date = new Date()) {
  return date.toISOString().slice(0, 10)
}

function utcMonthStart() {
  return `${utcDay().slice(0, 7)}-01`
}

function usedInPeriod(used: number | null, period: string | null, current: string) {
  if (period !== current) return 0
  return typeof used === "number" && Number.isFinite(used) ? used : 0
}

function paidAlive(row: SubscriptionRow) {
  if (row.plan !== "pro" && row.plan !== "premium") return false
  if (!row.current_period_end) return true
  const end = new Date(row.current_period_end).getTime()
  return Number.isFinite(end) && end > Date.now()
}

function usageFromRow(row: SubscriptionRow | null): UsageView {
  const today = utcDay()
  const month = utcMonthStart()
  const textUsed = row ? usedInPeriod(row.text_used, row.text_period, today) : 0
  const visionUsed = row ? usedInPeriod(row.vision_used, row.vision_period, month) : 0
  if (!row || !paidAlive(row)) {
    return { plan: "free", paid: false, textUsed, textCap: 20, visionUsed, visionCap: 10 }
  }
  return {
    plan: row.plan === "premium" ? "premium" : "pro",
    paid: true,
    textUsed,
    textCap: row.text_queries_daily,
    visionUsed,
    visionCap: row.vision_queries_monthly ?? 10,
  }
}

const THEME_OPTIONS: { id: ThemePreference; icon: typeof Sun; label: "nav.light" | "nav.dark" | "nav.system" }[] = [
  { id: "light", icon: Sun, label: "nav.light" },
  { id: "dark", icon: Moon, label: "nav.dark" },
  { id: "system", icon: Monitor, label: "nav.system" },
]

export function AccountMenu() {
  const { user, signOut } = useAuth()
  const { t } = useLanguage()
  const { theme, setTheme } = useMode()
  const panelId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [usageState, setUsageState] = useState<LoadState>({ status: "loading" })
  const [pendingPortal, setPendingPortal] = useState(false)
  const [portalFailed, setPortalFailed] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    if (!open) return
    const onPointer = (event: MouseEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return
      setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onPointer)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onPointer)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  useEffect(() => {
    if (!open || !user) return
    let cancelled = false
    setUsageState({ status: "loading" })
    setPortalFailed(false)
    const supabase = createClient()
    if (!supabase) {
      setUsageState({ status: "error" })
      return
    }
    void supabase
      .from("user_subscriptions")
      .select(
        "plan, status, current_period_end, text_used, text_period, text_queries_daily, vision_used, vision_period, vision_queries_monthly",
      )
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          setUsageState({ status: "error" })
          return
        }
        setUsageState({ status: "ready", usage: usageFromRow(data) })
      })
    return () => {
      cancelled = true
    }
  }, [open, user])

  if (!user) return null

  const initial = (user.email?.trim().charAt(0) || "?").toUpperCase()
  const usage = usageState.status === "ready" ? usageState.usage : null
  const planLabel = usage
    ? t(
        usage.plan === "premium"
          ? "account.planPremium"
          : usage.plan === "pro"
            ? "account.planPro"
            : "account.planFree",
      )
    : ""

  async function openPortal() {
    setPendingPortal(true)
    setPortalFailed(false)
    try {
      const response = await fetch("/api/portal", { method: "POST" })
      const payload = (await response.json().catch(() => null)) as { url?: string } | null
      if (!response.ok || typeof payload?.url !== "string" || !payload.url.startsWith("https://")) {
        setPortalFailed(true)
        return
      }
      window.location.href = payload.url
    } catch {
      setPortalFailed(true)
    } finally {
      setPendingPortal(false)
    }
  }

  async function onSignOut() {
    setSigningOut(true)
    const message = await signOut()
    if (message) setSigningOut(false)
  }

  const showUpgrade = usageState.status === "error" || (usage != null && !usage.paid) || portalFailed

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={t("account.open")}
        onClick={() => setOpen((value) => !value)}
        className="grid size-11 place-items-center rounded-full border border-border bg-card text-xs font-semibold text-foreground shadow-sm transition-colors hover:border-primary/40 md:size-8"
      >
        {initial}
      </button>
      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label={t("account.open")}
          className="absolute right-0 z-50 mt-2 w-[min(17rem,calc(100vw-1.5rem))] rounded-xl border border-border bg-card p-3 text-xs shadow-sm"
        >
          <div
            role="radiogroup"
            aria-label={t("nav.appearance")}
            className="mb-3 grid grid-cols-3 gap-1 rounded-lg bg-secondary p-1"
          >
            {THEME_OPTIONS.map((option) => {
              const Icon = option.icon
              const selected = theme === option.id
              return (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setTheme(option.id)}
                  className={cn(
                    "flex flex-col items-center gap-0.5 rounded-md px-1 py-1.5 text-[0.65rem] font-semibold leading-tight",
                    selected ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="size-3.5" aria-hidden="true" />
                  {t(option.label)}
                </button>
              )
            })}
          </div>
          <div className="space-y-1 text-muted-foreground">
            {usageState.status === "loading" ? (
              <p aria-hidden="true">…</p>
            ) : usageState.status === "error" || !usage ? (
              <p>{t("account.usageUnavailable")}</p>
            ) : (
              <>
                <p className="font-medium text-foreground">{t("account.plan", { name: planLabel })}</p>
                <p>
                  {usage.textCap == null
                    ? t("account.textUnlimited")
                    : t("account.textToday", { used: usage.textUsed, cap: usage.textCap })}
                </p>
                <p>{t("account.visionMonth", { used: usage.visionUsed, cap: usage.visionCap })}</p>
              </>
            )}
          </div>
          <div className="mt-3 flex flex-col gap-1.5">
            {usage?.paid ? (
              <button
                type="button"
                disabled={pendingPortal}
                onClick={() => void openPortal()}
                className="h-8 rounded-lg bg-brand-gradient px-2 text-xs font-semibold text-white disabled:cursor-wait disabled:opacity-70"
              >
                {t("account.manage")}
              </button>
            ) : null}
            {showUpgrade ? (
              <Link
                href="/#pricing"
                className={cn(
                  "grid h-8 place-items-center rounded-lg px-2 text-xs font-semibold",
                  usage?.paid
                    ? "border border-border text-foreground hover:bg-accent/60"
                    : "bg-brand-gradient text-white",
                )}
              >
                {t("account.upgrade")}
              </Link>
            ) : null}
            {portalFailed ? <p className="text-destructive">{t("account.portalUnavailable")}</p> : null}
            <button
              type="button"
              disabled={signingOut}
              onClick={() => void onSignOut()}
              className={cn(
                "h-8 rounded-lg border border-border px-2 text-xs font-semibold text-muted-foreground hover:text-foreground",
                "disabled:cursor-wait disabled:opacity-70",
              )}
            >
              {t("sidebar.signOut")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
