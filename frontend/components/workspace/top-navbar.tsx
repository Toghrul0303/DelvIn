"use client"

import Link from "next/link"
import { Menu, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { AccountMenu } from "./account-menu"
import { NAV_TABS } from "./data"
import { useLanguage } from "./language-context"

function Logo() {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/DelvIn_light_mode_transparent.png"
        alt="DelvIn"
        className="h-6 max-h-6 w-auto max-w-[34vw] shrink-0 object-contain md:max-w-none dark:hidden"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/DelvIn_dark_mode_transparent.png"
        alt=""
        className="hidden h-6 max-h-6 w-auto max-w-[34vw] shrink-0 object-contain md:max-w-none dark:block"
      />
    </>
  )
}

function Tabs() {
  const { t } = useLanguage()
  return (
    <nav aria-label={t("nav.workspaceSections")} className="hidden items-center gap-1 md:flex">
      <Link
        href="/"
        className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
      >
        {t("nav.home")}
      </Link>
      {NAV_TABS.map((tab) => (
        <Link
          key={tab}
          href="/workspace"
          className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground transition-colors"
        >
          {t(`nav.${tab}`)}
        </Link>
      ))}
    </nav>
  )
}

export function TopNavbar({
  menuOpen = false,
  onMenuToggle,
}: {
  menuOpen?: boolean
  onMenuToggle?: () => void
}) {
  const { t } = useLanguage()
  return (
    <header className="relative z-[500] box-border flex h-[calc(4rem+env(safe-area-inset-top))] shrink-0 items-center border-b border-border px-2 pt-[env(safe-area-inset-top)] md:px-4">
      <div className="flex items-center">
        <button
          type="button"
          onClick={onMenuToggle}
          aria-expanded={menuOpen}
          aria-controls="workspace-drawer"
          aria-label={menuOpen ? t("nav.closeMenu") : t("nav.openMenu")}
          className="grid size-11 place-items-center rounded-lg text-foreground transition-colors hover:bg-accent md:hidden"
        >
          {menuOpen ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
        </button>
        <Tabs />
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-[env(safe-area-inset-top)] flex h-16 items-center justify-center">
        <Logo />
      </div>

      <div className={cn("ml-auto flex items-center")}>
        <AccountMenu />
      </div>
    </header>
  )
}
