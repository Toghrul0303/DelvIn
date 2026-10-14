import Link from 'next/link'

const links = [
  { href: '/terms', label: 'Terms of Service' },
  { href: '/privacy', label: 'Privacy Policy' },
  { href: '/refund', label: 'Refund Policy' },
]

export function SiteFooter() {
  return (
    <footer className="border-t border-[#ebe7ef] bg-white px-5 py-8 sm:px-8 lg:px-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
        <div className="flex flex-col gap-1">
          <p className="text-xs text-[#9993a1]">© 2026 DelvIn</p>
        </div>
        <nav className="flex flex-col items-center gap-3 sm:flex-row sm:gap-8" aria-label="Legal">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-xs text-[#9993a1] transition-colors hover:text-[#a82e83]"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  )
}
