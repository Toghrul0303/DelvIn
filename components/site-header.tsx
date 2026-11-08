'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'

export function SiteHeader() {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const onHome = pathname === '/'

  return (
    <header className="sticky top-0 z-50 border-b border-[#ebe8f0]/90 bg-[#fbfbfd]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-10">
        <Link href="/" className="flex items-center" aria-label="DelvIn home">
          <img src="/DelvIn_light_mode_transparent.png" alt="DelvIn" className="h-6 max-h-6 w-auto shrink-0 object-contain dark:hidden" />
          <img src="/DelvIn_dark_mode_transparent.png" alt="" className="hidden h-6 max-h-6 w-auto shrink-0 object-contain dark:block" />
        </Link>
        <button className="rounded-lg p-2 text-[#6d687b] md:hidden" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu">
          {menuOpen ? <X size={21} /> : <Menu size={21} />}
        </button>
        <nav className={`${menuOpen ? 'flex' : 'hidden'} absolute left-4 right-4 top-[82px] flex-col gap-5 rounded-2xl border border-[#e8e4ee] bg-white p-5 shadow-xl md:static md:flex md:flex-row md:items-center md:gap-8 md:border-0 md:bg-transparent md:p-0 md:shadow-none`}>
          <Link href="/" className={`text-sm font-medium ${onHome ? 'text-[#a82e83]' : 'text-[#706b7c] transition-colors hover:text-[#a82e83]'}`}>Homepage</Link>
          <Link href="/workspace" className="text-sm font-medium text-[#706b7c] transition-colors hover:text-[#a82e83]">Workspace</Link>
          <Link href="/login" className="inline-flex items-center justify-center rounded-full bg-[#bf2b91] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_7px_18px_rgba(183,40,135,0.22)] transition hover:-translate-y-0.5 hover:bg-[#a8227e]">Login</Link>
        </nav>
      </div>
    </header>
  )
}
