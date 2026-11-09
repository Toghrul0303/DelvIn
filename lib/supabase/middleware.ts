import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { isMockAuth } from "@/lib/mock-auth"
import { getSupabasePublicEnv } from "./env"

function isWorkspacePath(pathname: string) {
  return pathname === "/workspace" || pathname.startsWith("/workspace/")
}

function redirectWorkspaceToLogin(request: NextRequest, sessionResponse?: NextResponse) {
  const url = request.nextUrl.clone()
  url.pathname = "/login"
  url.search = ""
  url.searchParams.set("next", "/workspace")
  const redirect = NextResponse.redirect(url)
  sessionResponse?.cookies.getAll().forEach((cookie) => {
    redirect.cookies.set(cookie)
  })
  return redirect
}

export async function updateSession(request: NextRequest) {
  if (isMockAuth()) return NextResponse.next({ request })

  const workspace = isWorkspacePath(request.nextUrl.pathname)
  const env = getSupabasePublicEnv()
  if (!env) return NextResponse.next({ request })

  let supabaseResponse = NextResponse.next({ request })
  const supabase = createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        supabaseResponse = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        )
      },
    },
  })

  const { data } = await supabase.auth.getUser()
  if (workspace && !data.user) return redirectWorkspaceToLogin(request, supabaseResponse)
  return supabaseResponse
}
