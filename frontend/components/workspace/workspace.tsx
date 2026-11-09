"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "./auth-context"
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

export type ActiveMenu = "drawer" | "chat" | "account" | "settings" | null

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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [activeMenu, setActiveMenu] = useState<ActiveMenu>(null)
  const [chatCollapsed, setChatCollapsed] = useState(false)
  const [chatWidth, setChatWidth] = useState(CHAT_WIDTH_DEFAULT)
  const activeMenuRef = useRef(activeMenu)
  activeMenuRef.current = activeMenu

  useEffect(() => {
    const stored = Number(window.localStorage.getItem(CHAT_WIDTH_KEY))
    if (Number.isFinite(stored) && stored > 0) setChatWidth(clampChatWidth(stored))
    if (window.matchMedia("(max-width: 767px)").matches) setChatCollapsed(true)
    if (window.matchMedia("(min-width: 768px) and (max-width: 1023px)").matches) {
      setSidebarCollapsed(true)
    }
  }, [])

  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)")
    const clearMobileOverlays = () => {
      if (!media.matches) return
      if (activeMenuRef.current === "chat") setChatCollapsed(false)
      setActiveMenu((current) => (current === "drawer" || current === "chat" ? null : current))
    }
    media.addEventListener("change", clearMobileOverlays)
    return () => media.removeEventListener("change", clearMobileOverlays)
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

  const toggleDrawer = useCallback(() => {
    setActiveMenu((current) => (current === "drawer" ? null : "drawer"))
  }, [])

  const toggleChat = useCallback(() => {
    if (window.matchMedia("(max-width: 767px)").matches) {
      setActiveMenu((current) => (current === "chat" ? null : "chat"))
      return
    }
    setChatCollapsed((collapsed) => !collapsed)
  }, [])

  const openChat = useCallback(() => {
    if (window.matchMedia("(max-width: 767px)").matches) {
      setActiveMenu("chat")
      return
    }
    setChatCollapsed(false)
  }, [])

  const closeChat = useCallback(() => {
    setActiveMenu((current) => (current === "chat" ? null : current))
  }, [])
  const closeDrawer = useCallback(() => {
    setActiveMenu((current) => (current === "drawer" ? null : current))
  }, [])
  const setAccountOpen = useCallback((open: boolean) => {
    setActiveMenu(open ? "account" : null)
  }, [])
  const setSettingsOpen = useCallback((open: boolean) => {
    setActiveMenu(open ? "settings" : null)
  }, [])

  useEffect(() => {
    if (authLoading || user) return
    router.replace(WORKSPACE_LOGIN)
  }, [authLoading, user, router])

  if (authLoading || !user) return null

  return (
      <SessionProvider>
      <TaskTrackerProvider>
      <DeskProvider>
      <WhiteboardProvider>
      <StudyModeProvider>
      <ExplainModeProvider>
        <SessionSliceSync />
        <div className="h-dvh w-full overflow-hidden">
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
            <TopNavbar
              menuOpen={activeMenu === "drawer"}
              onMenuToggle={toggleDrawer}
              accountOpen={activeMenu === "account"}
              settingsOpen={activeMenu === "settings"}
              onAccountOpenChange={setAccountOpen}
              onSettingsOpenChange={setSettingsOpen}
            />

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
                open={activeMenu === "chat"}
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
              open={activeMenu === "drawer"}
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
            <ChatCollapseFab
              collapsed={activeMenu === "chat" ? false : chatCollapsed}
              concealed={activeMenu === "drawer"}
              onExpand={openChat}
            />
          </div>
        </div>
      </div>
      </ExplainModeProvider>
      </StudyModeProvider>
      </WhiteboardProvider>
      </DeskProvider>
      </TaskTrackerProvider>
      </SessionProvider>
  )
}
