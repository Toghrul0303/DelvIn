import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { safeNextPath } from "@/lib/safe-next"
import { getSupabasePublicEnv } from "./env"

function isWorkspacePath(pathname: string) {
  return pathname === "/workspace" || pathname.startsWith("/workspace/")
}

function isLoginPath(pathname: string) {
  return pathname === "/login"
}

function redirectWithSession(url: URL, sessionResponse?: NextResponse) {
  const redirect = NextResponse.redirect(url)
  sessionResponse?.cookies.getAll().forEach((cookie) => {
    redirect.cookies.set(cookie)
  })
  return redirect
}

function redirectWorkspaceToLogin(request: NextRequest, sessionResponse?: NextResponse) {
  const url = request.nextUrl.clone()
  url.pathname = "/login"
  url.search = ""
  url.searchParams.set("next", "/workspace")
  return redirectWithSession(url, sessionResponse)
}

function redirectLoginToApp(request: NextRequest, sessionResponse?: NextResponse) {
  let next = safeNextPath(request.nextUrl.searchParams.get("next"))
  if (next === "/login" || next.startsWith("/login/") || next.startsWith("/login?")) {
    next = "/workspace"
  }
  const destination = new URL(next, request.url)
  const url = request.nextUrl.clone()
  url.pathname = destination.pathname
  url.search = destination.search
  return redirectWithSession(url, sessionResponse)
}

export async function updateSession(request: NextRequest) {
  const workspace = isWorkspacePath(request.nextUrl.pathname)
  const env = getSupabasePublicEnv()
  if (!env) {
    if (workspace) return redirectWorkspaceToLogin(request)
    return NextResponse.next({ request })
  }

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
  const login = isLoginPath(request.nextUrl.pathname)
  const callbackError = request.nextUrl.searchParams.get("error") === "callback"
  if (data.user && login && !callbackError) return redirectLoginToApp(request, supabaseResponse)
  if (workspace && !data.user) return redirectWorkspaceToLogin(request, supabaseResponse)
  return supabaseResponse
}
