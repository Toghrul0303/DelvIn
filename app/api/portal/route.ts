import { createPolar } from "@polar-sh/sdk/2026-10"
import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"

function polarEnvironment(): "sandbox" | "production" {
  return process.env.POLAR_SERVER?.trim() === "sandbox" ? "sandbox" : "production"
}

export async function POST(request: NextRequest) {
  const accessToken = process.env.POLAR_ACCESS_TOKEN?.trim() ?? ""
  if (!accessToken) {
    return NextResponse.json({ error: "Billing portal is not configured." }, { status: 503 })
  }

  const supabase = await createClient()
  if (!supabase) {
    return NextResponse.json({ error: "Sign in is not configured." }, { status: 503 })
  }

  const { data, error } = await supabase.auth.getUser()
  const user = data.user
  if (error || !user) {
    return NextResponse.json({ error: "Sign in to manage your subscription." }, { status: 401 })
  }

  try {
    const polar = createPolar({
      accessToken,
      environment: polarEnvironment(),
    })
    const session = await polar.customerSessions.create({
      external_customer_id: user.id,
      return_url: `${request.nextUrl.origin}/workspace`,
    })
    const url = session.customer_portal_url
    if (!url.startsWith("https://")) {
      return NextResponse.json({ error: "Could not open the billing portal." }, { status: 502 })
    }
    return NextResponse.json({ url })
  } catch (err) {
    console.error("[portal] Polar session failed", err)
    return NextResponse.json({ error: "Could not open the billing portal." }, { status: 502 })
  }
}
