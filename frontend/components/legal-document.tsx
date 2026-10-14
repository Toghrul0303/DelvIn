import type { ReactNode } from 'react'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'

export const CONTACT_EMAIL = 'support@delvin.study'

export function ContactLink() {
  return (
    <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#a82e83]">
      {CONTACT_EMAIL}
    </a>
  )
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8 first:mt-0">
      <h2 className="text-lg font-semibold tracking-[-0.03em] text-[#353042]">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-6 text-[#676171]">{children}</div>
    </section>
  )
}

export function LegalDocument({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="min-h-screen bg-[#fbfbfd] text-[#292638]">
      <SiteHeader />
      <section className="px-5 py-20 sm:px-8 lg:px-10 lg:py-28">
        <div className="mx-auto max-w-3xl">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-[#b52c89]">DelvIn</p>
          <h1 className="text-3xl font-semibold tracking-[-0.045em] sm:text-5xl">{title}</h1>
          <p className="mt-4 text-sm text-[#797483]">Last updated October 14, 2026</p>
          <div className="mt-10 rounded-3xl border border-[#e3dfe8] bg-white p-7 sm:p-10">{children}</div>
        </div>
      </section>
      <SiteFooter />
    </main>
  )
}
