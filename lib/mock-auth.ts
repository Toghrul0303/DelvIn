import type { Session, User } from "@supabase/supabase-js"

/** Signed-in stand-in for v0 previews and local runs without Supabase. */
export const DEMO_USER = {
  id: "demo-123",
  email: "toghrul@delvin.study",
  name: "Toghrul",
  plan: "Free",
} as const

/**
 * Visual-mock mode. Missing anon key is the v0 preview case. An explicit
 * Vercel preview build mocks too, even when preview env vars are injected,
 * so navigation is never sent to the login wall.
 */
export function isMockAuth(): boolean {
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? ""
  if (!anonKey) return true
  const vercelEnv = process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.VERCEL_ENV || ""
  return vercelEnv === "preview"
}

export function createDemoUser(): User {
  const now = "2026-01-01T00:00:00.000Z"
  return {
    id: DEMO_USER.id,
    aud: "authenticated",
    role: "authenticated",
    email: DEMO_USER.email,
    email_confirmed_at: now,
    phone: "",
    confirmed_at: now,
    last_sign_in_at: now,
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: {
      name: DEMO_USER.name,
      full_name: DEMO_USER.name,
      plan: DEMO_USER.plan,
    },
    identities: [],
    created_at: now,
    updated_at: now,
    is_anonymous: false,
  } as User
}

let cachedSession: Session | null = null

export function demoSession(): Session {
  if (cachedSession) return cachedSession
  const user = createDemoUser()
  cachedSession = {
    access_token: "demo-access-token",
    refresh_token: "demo-refresh-token",
    expires_in: 60 * 60 * 24 * 365,
    expires_at: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365,
    token_type: "bearer",
    user,
  }
  return cachedSession
}
