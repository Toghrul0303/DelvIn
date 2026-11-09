"use client"

import { createContext, useCallback, useContext, useLayoutEffect, useState, type ReactNode } from "react"
import { THEME_KEY, TIMER_KEY } from "@/lib/theme-init"

export type ThemePreference = "light" | "dark" | "system"

type ModeContextValue = {
  /** Resolved appearance. System follows the OS setting. */
  dark: boolean
  theme: ThemePreference
  setTheme: (theme: ThemePreference) => void
  showTimer: boolean
  setShowTimer: (show: boolean) => void
}

export const ModeContext = createContext<ModeContextValue>({
  dark: false,
  theme: "system",
  setTheme: () => {},
  showTimer: false,
  setShowTimer: () => {},
})

export function useMode() {
  return useContext(ModeContext)
}

function readTheme(): ThemePreference {
  const stored = window.localStorage.getItem(THEME_KEY)
  if (stored === "dark" || stored === "light" || stored === "system") return stored
  return "system"
}

function prefersDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
}

function resolveDark(theme: ThemePreference) {
  if (theme === "system") return prefersDark()
  return theme === "dark"
}

function applyThemeClass(theme: ThemePreference) {
  const dark = resolveDark(theme)
  const root = document.documentElement
  root.classList.remove("light", "dark")
  root.classList.add(dark ? "dark" : "light")
  root.style.colorScheme = dark ? "dark" : "light"
  return dark
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>("system")
  const [dark, setDark] = useState(false)
  const [showTimer, setShowTimerState] = useState(false)
  const [ready, setReady] = useState(false)

  useLayoutEffect(() => {
    const next = readTheme()
    setThemeState(next)
    setDark(applyThemeClass(next))
    setShowTimerState(window.localStorage.getItem(TIMER_KEY) === "on")
    setReady(true)
  }, [])

  useLayoutEffect(() => {
    if (!ready || theme !== "system") return
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const apply = () => setDark(applyThemeClass("system"))
    apply()
    media.addEventListener("change", apply)
    return () => media.removeEventListener("change", apply)
  }, [ready, theme])

  const setTheme = useCallback((next: ThemePreference) => {
    setThemeState(next)
    setDark(applyThemeClass(next))
    window.localStorage.setItem(THEME_KEY, next)
  }, [])

  const setShowTimer = useCallback((next: boolean) => {
    setShowTimerState(next)
    window.localStorage.setItem(TIMER_KEY, next ? "on" : "off")
  }, [])

  return (
    <ModeContext.Provider value={{ dark, theme, setTheme, showTimer, setShowTimer }}>
      {children}
    </ModeContext.Provider>
  )
}
