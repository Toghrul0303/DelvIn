import { safeNextPath } from "@/lib/safe-next"

export function featureLoginHref(currentPath: string): string {
  const params = new URLSearchParams({
    next: safeNextPath(currentPath),
    reason: "feature",
  })
  return `/login?${params.toString()}`
}

/** Send a guest to login and remember the page they were on. */
export function redirectGuestToLogin(navigate: (href: string) => void) {
  const current = `${window.location.pathname}${window.location.search}`
  navigate(featureLoginHref(current))
}
