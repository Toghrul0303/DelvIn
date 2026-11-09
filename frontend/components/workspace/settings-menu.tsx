"use client"

import { useEffect, useId, useRef, useState } from "react"
import { ChevronRight, Settings } from "lucide-react"
import { cn } from "@/lib/utils"
import { useLanguage } from "./language-context"
import { useMode, type ThemePreference } from "./mode-context"

const THEME_OPTIONS: { id: ThemePreference; label: "settings.systemDefault" | "nav.light" | "nav.dark" }[] = [
  { id: "system", label: "settings.systemDefault" },
  { id: "light", label: "nav.light" },
  { id: "dark", label: "nav.dark" },
]

export function SettingsMenu({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useLanguage()
  const { theme, setTheme, showTimer, setShowTimer } = useMode()
  const panelId = useId()
  const themeListId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [themeOpen, setThemeOpen] = useState(false)

  useEffect(() => {
    if (!open) setThemeOpen(false)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onPointer = (event: MouseEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return
      onOpenChange(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      event.preventDefault()
      event.stopPropagation()
      if (themeOpen) {
        setThemeOpen(false)
        return
      }
      onOpenChange(false)
    }
    document.addEventListener("mousedown", onPointer)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onPointer)
      document.removeEventListener("keydown", onKey)
    }
  }, [open, onOpenChange, themeOpen])

  const currentLabel = t(
    theme === "dark" ? "nav.dark" : theme === "light" ? "nav.light" : "settings.systemDefault",
  )

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={t("settings.open")}
        onClick={() => onOpenChange(!open)}
        className="grid size-11 place-items-center rounded-lg text-foreground transition-colors hover:bg-accent md:size-8"
      >
        <Settings className="size-5 md:size-4" aria-hidden="true" />
      </button>
      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label={t("settings.open")}
          className="absolute right-0 z-50 mt-2 max-h-[min(24rem,calc(100dvh-5.5rem))] w-[min(17rem,calc(100vw-1.5rem))] overflow-y-auto rounded-xl border border-border bg-card p-2 text-xs shadow-sm"
        >
          <button
            type="button"
            aria-expanded={themeOpen}
            aria-controls={themeListId}
            onClick={() => setThemeOpen((value) => !value)}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left font-medium text-foreground hover:bg-accent/60"
          >
            <span className="min-w-0 flex-1">
              <span className="block">{t("settings.theme")}</span>
              <span className="block truncate font-normal text-muted-foreground">{currentLabel}</span>
            </span>
            <ChevronRight
              className={cn("size-4 shrink-0 text-muted-foreground transition-transform", themeOpen && "rotate-90")}
              aria-hidden="true"
            />
          </button>
          {themeOpen ? (
            <div id={themeListId} role="radiogroup" aria-label={t("settings.theme")} className="mt-1 grid gap-0.5 px-1 pb-1">
              {THEME_OPTIONS.map((option) => {
                const selected = theme === option.id
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setTheme(option.id)}
                    className={cn(
                      "rounded-md px-2 py-2 text-left font-medium",
                      selected ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                    )}
                  >
                    {t(option.label)}
                  </button>
                )
              })}
            </div>
          ) : null}
          <button
            type="button"
            role="switch"
            aria-checked={showTimer}
            onClick={() => setShowTimer(!showTimer)}
            className="mt-1 flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left font-medium text-foreground hover:bg-accent/60"
          >
            <span>{t("settings.showTimer")}</span>
            <span
              className={cn(
                "relative h-5 w-9 shrink-0 rounded-full transition-colors",
                showTimer ? "bg-primary" : "bg-secondary",
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 size-4 rounded-full bg-background shadow-sm transition-transform",
                  showTimer ? "translate-x-4" : "translate-x-0.5",
                )}
              />
            </span>
          </button>
        </div>
      ) : null}
    </div>
  )
}
