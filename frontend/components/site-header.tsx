'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import { useAuth } from '@/components/workspace/auth-context'
import { AccountMenu } from '@/components/workspace/account-menu'
import { SettingsMenu } from '@/components/workspace/settings-menu'
import { cn } from '@/lib/utils'

type OpenPanel = 'nav' | 'settings' | 'account' | null

export function SiteHeader() {
  const pathname = usePathname()
  const { user, loading } = useAuth()
  const [open, setOpen] = useState<OpenPanel>(null)
  const onHome = pathname === '/'
  const navOpen = open === 'nav'

  const setSettingsOpen = useCallback((next: boolean) => {
    setOpen(next ? 'settings' : null)
  }, [])
  const setAccountOpen = useCallback((next: boolean) => {
    setOpen(next ? 'account' : null)
  }, [])

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-xl">
      <div className="mx-auto flex h-[calc(4.5rem+env(safe-area-inset-top))] max-w-7xl items-center justify-between gap-2 px-3 pt-[env(safe-area-inset-top)] sm:px-8 lg:px-10">
        <Link href="/" className="flex items-center" aria-label="DelvIn home">
          <img
            src="/DelvIn_light_mode_transparent.png"
            alt="DelvIn"
            className="h-6 max-h-6 w-auto max-w-[30vw] shrink-0 object-contain md:max-w-none dark:hidden"
          />
          <img
            src="/DelvIn_dark_mode_transparent.png"
            alt=""
            className="hidden h-6 max-h-6 w-auto max-w-[30vw] shrink-0 object-contain md:max-w-none dark:block"
          />
        </Link>

        <div className="flex items-center gap-1 md:gap-8">
          <nav
            className={cn(
              'absolute left-3 right-3 top-[calc(4.5rem+env(safe-area-inset-top))] flex-col gap-2 rounded-2xl border border-border bg-card p-3 shadow-xl md:static md:flex md:flex-row md:items-center md:gap-8 md:border-0 md:bg-transparent md:p-0 md:shadow-none',
              navOpen ? 'flex' : 'hidden md:flex',
            )}
          >
            <Link
              href="/"
              onClick={() => setOpen(null)}
              className={cn(
                'rounded-lg px-3 py-3 text-sm font-medium md:px-0 md:py-0',
                onHome ? 'text-primary' : 'text-muted-foreground transition-colors hover:text-primary',
              )}
            >
              Homepage
            </Link>
            <Link
              href="/workspace"
              onClick={() => setOpen(null)}
              className="rounded-lg px-3 py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-primary md:px-0 md:py-0"
            >
              Workspace
            </Link>
          </nav>

          <div className="flex items-center gap-0.5">
            <button
              type="button"
              className="grid size-11 place-items-center rounded-lg text-foreground md:hidden"
              aria-expanded={navOpen}
              aria-label={navOpen ? 'Close menu' : 'Open menu'}
              onClick={() => setOpen((current) => (current === 'nav' ? null : 'nav'))}
            >
              {navOpen ? <X size={21} /> : <Menu size={21} />}
            </button>
            <SettingsMenu
              open={open === 'settings'}
              onOpenChange={setSettingsOpen}
              showTimerToggle={false}
            />
            {loading ? (
              <span className="size-11 md:size-8" aria-hidden="true" />
            ) : user ? (
              <AccountMenu open={open === 'account'} onOpenChange={setAccountOpen} />
            ) : (
              <Link
                href="/login"
                className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground md:h-9 md:px-5"
              >
                Login
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
