export const DEFAULT_AUTH_NEXT = "/workspace"

/** Same-origin relative path only. Rejects protocol-relative and backslash URLs. */
export function safeNextPath(value: string | null | undefined): string {
  if (!value) return DEFAULT_AUTH_NEXT
  const path = value.trim()
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\") || path.includes("://")) {
    return DEFAULT_AUTH_NEXT
  }
  return path
}
