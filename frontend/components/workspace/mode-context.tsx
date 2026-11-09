"use client"

import { createContext, useContext } from "react"

export type ThemePreference = "light" | "dark" | "system"

type ModeContextValue = {
  /** Resolved appearance. System follows the OS setting. */
  dark: boolean
  theme: ThemePreference
  setTheme: (theme: ThemePreference) => void
}

export const ModeContext = createContext<ModeContextValue>({
  dark: false,
  theme: "light",
  setTheme: () => {},
})

export function useMode() {
  return useContext(ModeContext)
}
