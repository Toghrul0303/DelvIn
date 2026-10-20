"use client"

import { useState } from "react"
import { useAuth } from "@/components/workspace/auth-context"

const PLAN_NAMES = {
  Pro: "pro",
  Premium: "premium",
} as const

type PaidPlanName = keyof typeof PLAN_NAMES

function isPaidPlan(name: string): name is PaidPlanName {
  return name in PLAN_NAMES
}

export function PricingPlanButton({ name }: { name: string }) {
  const { user, loading } = useAuth()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isPaidPlan(name)) {
    return (
      <button
        type="button"
        disabled
        className="mt-7 w-full cursor-default rounded-full border border-[#ddd8e5] bg-white py-3 text-sm font-semibold text-[#554f61]"
      >
        Current plan
      </button>
    )
  }

  const plan = PLAN_NAMES[name]

  async function upgrade() {
    setError(null)
    if (!user) {
      window.location.href = `/login?next=${encodeURIComponent("/#pricing")}`
      return
    }
    setPending(true)
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      })
      const payload = (await response.json().catch(() => null)) as { url?: string; error?: string } | null
      if (response.status === 401) {
        window.location.href = `/login?next=${encodeURIComponent("/#pricing")}`
        return
      }
      if (!response.ok || typeof payload?.url !== "string" || !payload.url.startsWith("https://")) {
        setError(payload?.error || "Checkout is unavailable.")
        return
      }
      window.location.href = payload.url
    } catch {
      setError("Checkout is unavailable.")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="mt-7">
      <button
        type="button"
        disabled={pending || loading}
        onClick={() => void upgrade()}
        className="w-full rounded-full bg-[#ba2b8a] py-3 text-sm font-semibold text-white shadow-lg shadow-[#ba2b8a]/20 transition hover:-translate-y-0.5 hover:bg-[#a7247e] disabled:cursor-wait disabled:opacity-70"
      >
        {pending ? "Redirecting…" : "Upgrade now"}
      </button>
      {error ? <p className="mt-2 text-center text-xs text-[#a7247e]">{error}</p> : null}
    </div>
  )
}
