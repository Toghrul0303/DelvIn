import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { safeNextPath } from "@/lib/safe-next"

export async function GET(request: NextRequest) {
  const url = request.nextUrl
  const code = url.searchParams.get("code")
  const next = safeNextPath(url.searchParams.get("next"))
  const origin = url.origin

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=callback`)
  }

  const supabase = await createClient()
  if (!supabase) {
    return NextResponse.redirect(`${origin}/login?error=callback`)
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=callback`)
  }

  return NextResponse.redirect(`${origin}${next}`)
}
