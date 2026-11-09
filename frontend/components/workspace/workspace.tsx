"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { useAuth } from "./auth-context"
import { ModeContext, type ThemePreference } from "./mode-context"
import { TopNavbar } from "./top-navbar"
import { LeftSidebar } from "./left-sidebar"
import { Desk } from "./desk"
import { ChatCollapseFab, ChatPane } from "./chat-pane"
import { MobileSheet } from "./mobile-sheet"
import { TaskTrackerProvider } from "./task-tracker-context"
import { DeskProvider } from "./desk-context"
import { SessionProvider } from "./session-context"
import { SessionSliceSync } from "./session-slice-sync"
import { StudyModeProvider } from "./study-mode-context"
import { ExplainModeProvider } from "./explain-mode-context"
import { WhiteboardProvider } from "./canvas/whiteboard-context"
import { useLanguage } from "./language-context"

const THEME_KEY = "locknlearn.theme"

function readTheme(): ThemePreference {
  const stored = window.localStorage.getItem(THEME_KEY)
  if (stored === "dark" || stored === "light" || stored === "system") return stored
  return "light"
}

function prefersDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
}

function resolveDark(theme: ThemePreference) {
  if (theme === "system") return prefersDark()
  return theme === "dark"
}
const CHAT_WIDTH_KEY = "locknlearn.chatWidth"
const CHAT_WIDTH_DEFAULT = 400
const CHAT_WIDTH_MIN = 360
const WORKSPACE_LOGIN = "/login?next=/workspace"

function clampChatWidth(value: number) {
  const max = Math.max(CHAT_WIDTH_MIN, Math.round(window.innerWidth * 0.33))
  return Math.min(Math.max(Math.round(value), CHAT_WIDTH_MIN), max)
}

export function Workspace() {
  const router = useRouter()
  const { t } = useLanguage()
  const { user, loading: authLoading } = useAuth()
  const [theme, setThemeState] = useState<ThemePreference>("light")
  const [dark, setDark] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [chatCollapsed, setChatCollapsed] = useState(false)
  const [chatWidth, setChatWidth] = useState(CHAT_WIDTH_DEFAULT)

  useEffect(() => {
    const next = readTheme()
    setThemeState(next)
    setDark(resolveDark(next))
    const stored = Number(window.localStorage.getItem(CHAT_WIDTH_KEY))
    if (Number.isFinite(stored) && stored > 0) setChatWidth(clampChatWidth(stored))
    if (window.matchMedia("(max-width: 767px)").matches) setChatCollapsed(true)
    if (window.matchMedia("(min-width: 768px) and (max-width: 1023px)").matches) {
      setSidebarCollapsed(true)
    }
  }, [])

  useEffect(() => {
    if (theme !== "system") return
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const apply = () => setDark(media.matches)
    apply()
    media.addEventListener("change", apply)
    return () => media.removeEventListener("change", apply)
  }, [theme])

  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)")
    const closeDrawer = () => {
      if (media.matches) setDrawerOpen(false)
    }
    media.addEventListener("change", closeDrawer)
    return () => media.removeEventListener("change", closeDrawer)
  }, [])

  useEffect(() => {
    const onResize = () => setChatWidth((width) => clampChatWidth(width))
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])

  const setChatWidthLive = useCallback((value: number) => {
    setChatWidth(clampChatWidth(value))
  }, [])

  const commitChatWidth = useCallback((value: number) => {
    const next = clampChatWidth(value)
    setChatWidth(next)
    window.localStorage.setItem(CHAT_WIDTH_KEY, String(next))
  }, [])

  const setTheme = useCallback((next: ThemePreference) => {
    setThemeState(next)
    setDark(resolveDark(next))
    window.localStorage.setItem(THEME_KEY, next)
  }, [])

  const toggleDrawer = useCallback(() => {
    setDrawerOpen((open) => {
      const next = !open
      if (next) setChatCollapsed(true)
      return next
    })
  }, [])

  const toggleChat = useCallback(() => {
    setChatCollapsed((collapsed) => {
      const next = !collapsed
      if (!next) setDrawerOpen(false)
      return next
    })
  }, [])

  const openChat = useCallback(() => {
    setChatCollapsed(false)
    setDrawerOpen(false)
  }, [])

  const closeChat = useCallback(() => setChatCollapsed(true), [])
  const closeDrawer = useCallback(() => setDrawerOpen(false), [])

  useEffect(() => {
    if (authLoading || user) return
    router.replace(WORKSPACE_LOGIN)
  }, [authLoading, user, router])

  if (authLoading || !user) return null

  return (
    <ModeContext.Provider value={{ dark, theme, setTheme }}>
      <SessionProvider>
      <TaskTrackerProvider>
      <DeskProvider>
      <WhiteboardProvider>
      <StudyModeProvider>
      <ExplainModeProvider>
        <SessionSliceSync />
        <div className={cn("h-dvh w-full overflow-hidden", dark && "dark")}>
        <div className="relative flex h-full flex-col bg-background text-foreground">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                "radial-gradient(60rem 40rem at 85% -10%, color-mix(in oklab, var(--brand-purple) 14%, transparent), transparent), radial-gradient(50rem 40rem at -10% 110%, color-mix(in oklab, var(--brand-red) 12%, transparent), transparent)",
            }}
          />

          <div className="relative z-10 flex h-full flex-col">
            <TopNavbar menuOpen={drawerOpen} onMenuToggle={toggleDrawer} />

            <div className="flex min-h-0 flex-1">
              <LeftSidebar
                collapsed={sidebarCollapsed}
                onToggle={() => setSidebarCollapsed((c) => !c)}
              />

              <main className="relative flex min-w-0 flex-1">
                <Desk />
              </main>

              <MobileSheet
                side="bottom"
                open={!chatCollapsed}
                onClose={closeChat}
                label={t("chat.aria")}
                columnWidth={chatWidth}
                columnCollapsed={chatCollapsed}
              >
                <ChatPane
                  collapsed={chatCollapsed}
                  chatWidth={chatWidth}
                  onChatWidthChange={setChatWidthLive}
                  onChatWidthCommit={commitChatWidth}
                  onToggle={toggleChat}
                />
              </MobileSheet>
            </div>
            <MobileSheet
              id="workspace-drawer"
              side="left"
              open={drawerOpen}
              onClose={closeDrawer}
              label={t("sidebar.workspace")}
            >
              <LeftSidebar
                variant="drawer"
                collapsed={false}
                onToggle={closeDrawer}
                onNavigate={closeDrawer}
              />
            </MobileSheet>
            <ChatCollapseFab collapsed={chatCollapsed} concealed={drawerOpen} onExpand={openChat} />
          </div>
        </div>
      </div>
      </ExplainModeProvider>
      </StudyModeProvider>
      </WhiteboardProvider>
      </DeskProvider>
      </TaskTrackerProvider>
      </SessionProvider>
    </ModeContext.Provider>
  )
}
