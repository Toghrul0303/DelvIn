import { Suspense } from "react"
import { CollectionsPage } from "@/components/collections/collections-page"

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-background font-sans text-foreground" />}>
      <div className="font-sans text-foreground">
        <CollectionsPage />
      </div>
    </Suspense>
  )
}
