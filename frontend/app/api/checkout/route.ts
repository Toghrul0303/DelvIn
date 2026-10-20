import { createPolar } from "@polar-sh/sdk/2026-10"
import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"

type PaidPlan = "pro" | "premium"

function paidPlan(value: unknown): PaidPlan | null {
  return value === "pro" || value === "premium" ? value : null
}

function polarEnvironment(): "sandbox" | "production" {
  return process.env.POLAR_SERVER?.trim() === "sandbox" ? "sandbox" : "production"
}

export async function POST(request: NextRequest) {
  const accessToken = process.env.POLAR_ACCESS_TOKEN?.trim() ?? ""
  const productIds: Record<PaidPlan, string> = {
    pro: process.env.POLAR_PRO_PRODUCT_ID?.trim() ?? "",
    premium: process.env.POLAR_PREMIUM_PRODUCT_ID?.trim() ?? "",
  }
  if (!accessToken || !productIds.pro || !productIds.premium) {
    return NextResponse.json({ error: "Checkout is not configured." }, { status: 503 })
  }

  const supabase = await createClient()
  if (!supabase) {
    return NextResponse.json({ error: "Sign in is not configured." }, { status: 503 })
  }

  const { data, error } = await supabase.auth.getUser()
  const user = data.user
  if (error || !user) {
    return NextResponse.json({ error: "Sign in to upgrade." }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 })
  }

  const plan = paidPlan(body && typeof body === "object" ? (body as { plan?: unknown }).plan : null)
  if (!plan) {
    return NextResponse.json({ error: "Choose Pro or Premium." }, { status: 400 })
  }

  try {
    const polar = createPolar({
      accessToken,
      environment: polarEnvironment(),
    })
    const checkout = await polar.checkouts.create({
      products: [productIds[plan]],
      external_customer_id: user.id,
      customer_email: user.email ?? null,
      metadata: {
        user_id: user.id,
        plan_name: plan,
      },
      success_url: `${request.nextUrl.origin}/#pricing`,
    })
    return NextResponse.json({ url: checkout.url })
  } catch (err) {
    console.error("[checkout] Polar session failed", err)
    return NextResponse.json({ error: "Could not start checkout." }, { status: 502 })
  }
}
