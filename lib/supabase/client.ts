import { createBrowserClient } from "@supabase/ssr"
import { isMockAuth } from "@/lib/mock-auth"
import { getSupabasePublicEnv } from "./env"

export function createClient() {
  if (isMockAuth()) return null
  const env = getSupabasePublicEnv()
  if (!env) return null
  return createBrowserClient(env.url, env.anonKey)
}
